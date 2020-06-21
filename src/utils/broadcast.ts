import { WebSocketClient } from '../WebSocketClient';
import { getAllConnections, getUserByConnectionId } from '../module/userDBService';
import { getAllGames, getGameByGameId } from '../module/gameDBService';
import { User } from '../models/User';
import { Game } from '../models/Game';
import {
  createGameUpdateResponse,
  createInGameMessageResponse,
  createInGameUpdateResponse,
  createUserUpdateResponse,
  createGetAllGamesResponse,
  createGetAllUsersResponse,
  createSendMessageResponse,
} from './createWSResponse';
import { removeDynamoDocumentVersion } from './dbHelper';
import { WebSocketActions } from '../types/WebSocketActions';
import { GameStates, UserStates } from '../types/states';

/* ----------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/**
 * Get connection Ids from a list of User objects.
 * @param {User[]} usersList users list
 */
export const getConnectionIdsFromUsers = (usersList: User[]): string[] => {
  return usersList.map((user) => user.connectionId);
};

/**
 * Filter out caller connection Id from a list of connection Ids.
 * @param {string} callerConnectionId caller connection Id
 * @param {string} connectionIds connection Ids
 */
export const getConnectionIdsExceptCaller = (callerConnectionId: string, connectionIds: string[]): string[] => {
  return connectionIds.filter((otherConnectionId) => otherConnectionId !== callerConnectionId);
};

/* ----------------------------------------------------------------------------
 * User
 * ------------------------------------------------------------------------- */

/**
 * Broadcast all the connections to a user.
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string} connectionId connection Id
 */
export const broadcastConnections = async (ws: WebSocketClient, connectionId: string): Promise<User[] | []> => {
  const users: User[] = await getAllConnections();

  if (users && users.length > 0) {
    console.log('Connections:', users);
    console.log('Type of Connections:', typeof users);

    // Create users response object
    const wsResponse = createGetAllUsersResponse({
      users,
    });

    // Send all the active connections to a user
    await ws.send(wsResponse, connectionId);
  }

  return users || [];
};

/**
 * Broadcast user update to every other user (except the one with connectionId specified in the argument)
 * @param {WebSocketClient} ws WebSocket client
 * @param {string} callerConnectionId connection Id
 * @param {UserStates} state user state
 * @param allConnectionIds connection ids from all the currently connected users
 */
export const broadcastUserUpdate = async (
  ws: WebSocketClient,
  callerConnectionId: string,
  state: UserStates,
  allConnectionIds: string[],
): Promise<User | undefined> => {
  const currentUser = await getUserByConnectionId(callerConnectionId);
  console.log('Current user calling broadcastUserUpdate:', currentUser);

  if (currentUser) {
    const wsResponse = createUserUpdateResponse({
      user: currentUser,
      state,
    });

    const otherConnectionIds = getConnectionIdsExceptCaller(callerConnectionId, allConnectionIds);
    await Promise.all(
      otherConnectionIds.map((otherConnectionId) => {
        return ws.send(wsResponse, otherConnectionId);
      }),
    );
  }

  return currentUser;
};

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

  // Make games an empty array if games are empty
  console.log('Games:', games);

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
 * @param {GameStates} state of the game
 * @param callerConnectionId caller's connection Id
 * @param allConnectionIds connection ids from all the currently connected users
 */
export const broadcastGameUpdate = async (
  ws: WebSocketClient,
  gameId: string,
  state: GameStates,
  callerConnectionId: string,
  allConnectionIds: string[],
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
    const otherConnectionIds = getConnectionIdsExceptCaller(callerConnectionId, allConnectionIds);
    await Promise.all(
      otherConnectionIds.map((otherConnectionId) => {
        return ws.send(wsResponse, otherConnectionId);
      }),
    );
  }

  return updatedGame;
};

/**
 * Broadcast a message about who is joining the game with the IN_GAME_MESSAGE action
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string} callConnectionId caller's connection Id
 * @param {WebSocketActions.JOIN_GAME | WebSocketActions.LEAVE_GAME} action join or leave game action
 * @param {string[]} connectionIds connection Ids of all users who are in the same game
 * @param {string} callerUsername caller's username
 */
export const broadcastInGameMessage = async (
  ws: WebSocketClient,
  callConnectionId: string,
  action: WebSocketActions.JOIN_GAME | WebSocketActions.LEAVE_GAME,
  connectionIds: string[],
  callerUsername: string | undefined = undefined,
): Promise<void> => {
  let username: string;
  if (!callerUsername) {
    // For onLeaveGame and onJoinGame, need to get user's username
    const user = (await getUserByConnectionId(callConnectionId)) as User;

    username = user.username || 'Unknown User'; // TODO: change to a more appropriate name
  } else {
    // For onDisconnect, need to provide username
    username = callerUsername;
  }

  // Format message
  const actionWord: string = action === WebSocketActions.JOIN_GAME ? 'joined' : 'left';
  const message = `${username || callConnectionId} just ${actionWord} the game.`;

  // Send message to the other connectionIds that are already in the game
  const otherConnectionIds = connectionIds.filter((otherConnectionId) => otherConnectionId !== callConnectionId);
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
 * @param {string} callConnectionId caller's connection Id
 * @param {User[]} usersInGame current users list in the game
 */
export const broadcastInGameUpdate = async (
  ws: WebSocketClient,
  callConnectionId: string,
  usersInGame: User[],
): Promise<User[]> => {
  // Send users list to the other connectionIds that are already in the game
  const otherConnectionIds = getConnectionIdsExceptCaller(callConnectionId, getConnectionIdsFromUsers(usersInGame));
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

/* ----------------------------------------------------------------------------
 * Message
 * ------------------------------------------------------------------------- */

/**
 * Broadcast a message to all users.
 * @param {WebSocketClient} ws a WebSocketClient instance
 * @param {string} username username of the user who send the message to all other users
 * @param {string} message message content
 */
export const broadcastMessage = async (
  ws: WebSocketClient,
  username: string,
  message: string,
): Promise<User[] | []> => {
  const users: User[] = await getAllConnections();
  console.log('broadcastMessage to connections:', users);

  if (users && users.length > 0) {
    const wsResponse = createSendMessageResponse({
      username,
      message,
    });

    // Send a message to all the active connections
    await Promise.all(
      users.map((connection) => {
        // Send all connections to all users
        return ws.send(wsResponse, connection.connectionId);
      }),
    );
  }

  return users || [];
};
