import { WebSocketClient } from '../WebSocketClient';
import { Game } from '../../models/Game';
import { getAllGames, getGameByGameId, getUsersInGame } from '../../dynamodb/gameDBService';
import { getHandByConnectionId, removeDynamoDocumentVersion } from '../../dynamodb/dbHelper';
import {
  createDrawRoundResponse,
  createDrawTileResponse,
  createGameStartResponse,
  createGameUpdateResponse,
  createGetAllGamesResponse,
  createInGameMessageResponse,
  createInGameUpdateResponse,
  createPlayTileResponse,
  createSelfPlayTileResponse,
  createUpdateGameStateResponse,
  createWinningTilesResponse,
} from '../createWSResponse';
import { GameStatesEnum } from '../../enums/states';
import { WebSocketActionsEnum } from '../../enums/WebSocketActionsEnum';
import { getUserByConnectionId } from '../../dynamodb/userDBService';
import { User } from '../../models/User';
import {
  drawTile,
  getCurrentDealer,
  getCurrentTileIndex,
  initGameState,
  startNewGameRound,
} from '../../dynamodb/gameStateDBService';
import { getConnectionIdsExceptCaller, getConnectionIdsFromUsers, sleep } from '../../utils/broadcastHelper';
import { GameState, SelfPlayedTile, UserHand } from '../../models/GameState';
import { SelfPlayTilePayload } from '../../types/payload';
import { HandPointResults } from '../../games/mahjong/types/MahjongTypes';
import { Wall } from '../../games/mahjong/Wall/Wall';
import { LambdaResponse } from '../../types/response';
import { response } from '../../utils/responseHelper';

/* ----------------------------------------------------------------------------
 * Game
 * ------------------------------------------------------------------------- */
/**
 * Broadcast all the currently active games to a user.
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string} connectionId connection Id
 */
export const broadcastGames = async (ws: WebSocketClient, connectionId: string): Promise<Game[] | []> => {
  const games = await getAllGames();
  games.forEach((game) => {
    // Remove document version on game object
    removeDynamoDocumentVersion<Game>(game);
  });

  // Create games response object
  const wsResponse = createGetAllGamesResponse({
    games,
  });

  // Send all games each user
  await ws.send(wsResponse, connectionId);

  return games || [];
};

/**
 * Broadcast game update to all users except the game host
 * @param {WebSocketClient} ws WebSocket client
 * @param {string} gameId game Id
 * @param {GameStatesEnum} state of the game
 * @param {string} callerConnectionId caller's connection Id
 * @param {string[]} allConnectionIds connection ids from all the currently connected users
 * @param {boolean} sendToAll flag to whether sent to all users or not
 */
export const broadcastGameUpdate = async (
  ws: WebSocketClient,
  gameId: string,
  state: GameStatesEnum,
  callerConnectionId: string,
  allConnectionIds: string[],
  sendToAll = false,
): Promise<Game | undefined> => {
  // Get updated game info
  const updatedGame = await getGameByGameId(gameId);

  if (updatedGame) {
    // Remove document version on game object
    removeDynamoDocumentVersion<Game>(updatedGame);

    // Send game update to all other users (except the caller or the game creator)
    const wsResponse = createGameUpdateResponse({
      game: updatedGame,
      state,
    });

    let promises: Promise<unknown>[];
    if (sendToAll) {
      promises = allConnectionIds.map((connectionId) => {
        return ws.send(wsResponse, connectionId);
      });
    } else {
      const otherConnectionIds = getConnectionIdsExceptCaller(callerConnectionId, allConnectionIds);
      promises = otherConnectionIds.map((otherConnectionId) => {
        return ws.send(wsResponse, otherConnectionId);
      });
    }

    await Promise.all(promises);
  }

  return updatedGame;
};

/**
 * Broadcast a message about who is joining the game with the IN_GAME_MESSAGE action
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string} callerConnectionId caller's connection Id
 * @param {WebSocketActionsEnum.JOIN_GAME | WebSocketActionsEnum.LEAVE_GAME} action join or leave game action
 * @param {string[]} connectionIds connection Ids of all users who are in the same game
 * @param {string} callerUsername caller's username
 */
export const broadcastInGameMessage = async (
  ws: WebSocketClient,
  callerConnectionId: string,
  action: WebSocketActionsEnum.JOIN_GAME | WebSocketActionsEnum.LEAVE_GAME,
  connectionIds: string[],
  callerUsername: string | undefined = undefined,
): Promise<void> => {
  let username: string;
  if (!callerUsername) {
    // For onLeaveGame and onJoinGame, need to get user's username
    const user = (await getUserByConnectionId(callerConnectionId)) as User;

    username = user.username || 'Unknown User'; // TODO: change to a more appropriate name
  } else {
    // For onDisconnect, need to provide username
    username = callerUsername;
  }

  // Format message
  const actionWord: string = action === WebSocketActionsEnum.JOIN_GAME ? 'joined' : 'left';
  const message = `${username || callerConnectionId} just ${actionWord} the game.`;

  // Send message to the other connectionIds that are already in the game
  const otherConnectionIds = connectionIds.filter((otherConnectionId) => otherConnectionId !== callerConnectionId);
  const wsResponse = createInGameMessageResponse(username, message);
  await Promise.all(
    otherConnectionIds.map((otherConnectionId) => {
      return ws.send(wsResponse, otherConnectionId);
    }),
  );
};

/**
 * Broadcast in game update about the current users list in the game
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string} callerConnectionId caller's connection Id
 * @param {User[]} usersInGame current users list in the game
 */
export const broadcastInGameUpdate = async (
  ws: WebSocketClient,
  callerConnectionId: string,
  usersInGame: User[],
): Promise<User[]> => {
  // Send users list to the other connectionIds that are already in the game
  const otherConnectionIds = getConnectionIdsExceptCaller(callerConnectionId, getConnectionIdsFromUsers(usersInGame));
  const wsResponse = createInGameUpdateResponse({
    users: usersInGame,
  });
  await Promise.all(
    otherConnectionIds.map((otherConnectionId) => {
      return ws.send(wsResponse, otherConnectionId);
    }),
  );

  return usersInGame;
};

/**
 * Broadcast initial hands to users when game pages are all loaded on the client side.
 * 1. If a new game is started, use initGameState function to add a new row to game state
 * 2. If a new round is started (within the same game), use the gameState passed in via arguments
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string} gameId Game Id
 * @param {string[]} connectionIds All connection Ids in a game
 * @param {boolean} startNewGame Starting a new game or not
 * @param {GameState} gameState New gameState of a game
 */
export const broadcastGameStart = async (
  ws: WebSocketClient,
  gameId: string,
  connectionIds: string[],
  startNewGame: boolean,
  gameState?: GameState,
): Promise<void> => {
  let hands: UserHand[];
  let currentIndex: number;

  // For starting a new game
  if (startNewGame) {
    const newGameState = await initGameState(gameId, connectionIds);
    hands = newGameState.hands;
    currentIndex = newGameState.currentIndex;
  } else if (!startNewGame && gameState) {
    // For starting a new round in a game
    hands = gameState.hands;
    currentIndex = gameState.currentIndex;
  } else {
    // Error
    throw Error('broadcastGameStart: Failed to start a new game, please double check params passed in');
  }

  // Get self played tiles from all users in the game
  const allSelfPlayedTilesAtStart = hands.map((hand) => {
    return {
      connectionId: hand.connectionId,
      playedTiles: hand.playedTiles,
    };
  }) as SelfPlayedTile[];

  const promises = connectionIds.map((connectionId) => {
    const { hand: tiles } = getHandByConnectionId(hands, connectionId);

    // Put random tiles in response
    const wsResponse = createGameStartResponse({
      tiles,
      selfPlayedTiles: allSelfPlayedTilesAtStart,
      currentIndex,
    });
    // Send tiles as a string to each user in the game
    return ws.send(wsResponse, connectionId);
  });

  await Promise.all(promises);
};

/**
 * Broadcast DRAW_ROUND to users when the wall runs out of tile.
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string} gameId Game Id
 * @param {string} connectionId Connection Id
 * @param {string[]} connectionIds All connection Ids in the game
 */
export const broadcastDrawRound = async (
  ws: WebSocketClient,
  gameId: string,
  connectionId: string,
  connectionIds: string[],
): Promise<void> => {
  const wsResponse = createDrawRoundResponse({ gameId, connectionId });
  await Promise.all(connectionIds.map((cid) => ws.send(wsResponse, cid)));
};

/**
 * Broadcast updated game state after game round ends
 * @param {WebSocketClient} ws WebSocketClient instance
 * @param {string[]} connectionIds connectionIds of all users in game
 * @param {number} dealer current dealer
 * @param {number} wind current wind
 */
export const broadcastUpdateGameState = async (
  ws: WebSocketClient,
  connectionIds: string[],
  dealer: number,
  wind: number,
): Promise<void> => {
  const wsResponse = createUpdateGameStateResponse({
    dealer,
    wind,
  });
  await Promise.all(connectionIds.map((cid) => ws.send(wsResponse, cid)));
};

/**
 * Broadcast new hands to all users and Resets game round
 * @param {WebSocketClient} ws WebSocketClient instance
 * @param {string[]} connectionIds All user connection ids in a game
 * @param {GameState} gameState Game state
 */
export const broadcastGameReset = async (
  ws: WebSocketClient,
  connectionIds: string[],
  gameState: GameState,
): Promise<void> => {
  await broadcastGameStart(ws, '', connectionIds, false, gameState);
};

/**
 * Helper function to start a new round of a game and send updates (UPDATE_GAME_STATE, GAME_START) to users.
 * @param {WebSocketClient} ws Websocket client
 * @param {string} gameId Game Id
 * @param {string} connectionId Connection Id of the caller
 * @param {User[]} users List of users in a game
 * @param {number} dealer Current dealer index
 */
export const startNewRoundAndSendUpdates = async (
  ws: WebSocketClient,
  gameId: string,
  connectionId: string,
  users: User[],
  dealer: number,
): Promise<LambdaResponse | undefined> => {
  const connectionIds = getConnectionIdsFromUsers(users);

  // Start a new round and update the dealer/wind
  const updatedGameState = await startNewGameRound(
    gameId,
    connectionIds,
    users[dealer].connectionId !== connectionId, // change dealer if winner is not currently a dealer
  );
  if (!updatedGameState) {
    return response(400, 'Cannot start new game round');
  }

  // Send UPDATE_GAME_STATE with current dealer and wind to all connections
  const { dealer: newDealer, currentWind } = updatedGameState;
  await broadcastUpdateGameState(ws, connectionIds, newDealer, currentWind);

  // Send GAME_START to start a new round and send new hands to users
  await sleep(5000); // Delay 5s before sending GAME_START to client
  await broadcastGameReset(ws, connectionIds, updatedGameState);

  return undefined;
};

/**
 * Broadcast a tile string to a user in the game.
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string} gameId Game Id
 * @param {string} connectionId Connection Id
 */
export const broadcastDrawTileToUser = async (
  ws: WebSocketClient,
  gameId: string,
  connectionId: string,
): Promise<void> => {
  const tileDrawn = await drawTile(gameId);

  if (!tileDrawn || tileDrawn === '') {
    // Double check to make sure tile index reach 144
    const currentIndex = (await getCurrentTileIndex(gameId)) as number;
    if (currentIndex !== Wall.DEFAULT_WALL_LENGTH) {
      throw Error('broadcastDrawTileToUser: Draw empty tile while currentIndex did not reach 144');
    }

    // Users must exist in the game
    const users = await getUsersInGame(gameId);
    if (!users) throw Error('broadcastDrawTileToUser: No user found in game, failed to broadcast DRAW_ROUND');

    const connectionIds = getConnectionIdsFromUsers(users);
    await broadcastDrawRound(ws, gameId, connectionId, connectionIds);

    const currentDealer = (await getCurrentDealer(gameId)) as number;
    await startNewRoundAndSendUpdates(ws, gameId, connectionId, users, currentDealer);
    return;
  }

  const wsResponse = createDrawTileResponse({
    tile: tileDrawn,
    currentIndex: (await getCurrentTileIndex(gameId)) as number,
  });
  await ws.send(wsResponse, connectionId);
};

/**
 * Broadcast a tile string that is discarded by a user to all users in the game.
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string} tile tile discarded by a user
 * @param callerConnectionId caller's connection Id
 * @param {string[]} connectionIds connectionIds connection Ids of all users who are in the same game
 */
export const broadcastPlayedTileToUsers = async (
  ws: WebSocketClient,
  tile: string,
  callerConnectionId: string,
  connectionIds: string[],
): Promise<string> => {
  const wsResponse = createPlayTileResponse({
    connectionId: callerConnectionId,
    tile,
  });

  await Promise.all(
    connectionIds.map((connectionId) => {
      return ws.send(wsResponse, connectionId);
    }),
  );

  return tile;
};

/**
 * Broadcast who won game and their winning tiles to all users in game
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string[]} connectionIds connection ids of all users
 * @param {string} connectionId connectionId of winner
 * @param {HandPointResults} handPointResults A winning hand with tiles and points
 */
export const broadcastWinningTiles = async (
  ws: WebSocketClient,
  connectionIds: string[],
  connectionId: string,
  handPointResults: HandPointResults,
): Promise<void> => {
  const wsResponse = createWinningTilesResponse({
    connectionId,
    handPointResults,
  });
  await Promise.all(connectionIds.map((cid) => ws.send(wsResponse, cid)));
};

/**
 *
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string[]} connectionIds Connection ids of all users
 * @param {SelfPlayTilePayload} payload Payload for SELF_PLAY_TILE route
 */
export const broadcastSelfPlayTile = async (
  ws: WebSocketClient,
  connectionIds: string[],
  payload: SelfPlayTilePayload,
): Promise<void> => {
  const wsResponse = createSelfPlayTileResponse(payload);
  await Promise.all(connectionIds.map((cid) => ws.send(wsResponse, cid)));
};
