import { Handler } from 'aws-lambda';
import { addUserToGame } from '../../dynamodb/gameDBService';
import { response } from '../../utils/responseHelper';
import { Logger } from '../../utils/Logger';
import { WebSocketClient } from '../../websocket/WebSocketClient';
import {
  createJoinGameResponse,
  failedWebSocketResponse,
  successWebSocketResponse,
} from '../../websocket/createWSResponse';
import { removeDynamoDocumentVersion } from '../../dynamodb/dbHelper';
import { Game } from '../../models/Game';
import { LambdaEventBody, WebSocketAPIGatewayEvent } from '../../types/event';
import { LambdaEventBodyPayloadOptions } from '../../types/payload';
import { LambdaResponse } from '../../types/response';
import { WebSocketActionsEnum } from '../../enums/WebSocketActionsEnum';
import { setGameIdForUser } from '../../dynamodb/userDBService';
import { broadcastInGameMessage, broadcastInGameUpdate } from '../../websocket/broadcast/gameBroadcast';

/* ----------------------------------------------------------------------------
 * Handler Helper Functions
 * ------------------------------------------------------------------------- */
/**
 * Helper function for a user to join a game.
 * @param {WebSocketClient} ws WebSocketClient
 * @param {string} connectionId connection id
 * @param {string} gameId game id
 */
const joinGame = async (ws: WebSocketClient, connectionId: string, gameId: string): Promise<Game | undefined> => {
  // Add user to game
  const updatedGame = await addUserToGame(gameId, connectionId);

  if (updatedGame) {
    // Remove document version on game object
    removeDynamoDocumentVersion<Game>(updatedGame);

    // Add gameId as a reference to the current user
    await setGameIdForUser(connectionId, gameId);

    // Send success response
    const res = createJoinGameResponse({ game: updatedGame });
    const updatedGameResponse = successWebSocketResponse(res);
    await ws.send(updatedGameResponse, connectionId);

    return updatedGame;
  }

  return undefined;
};

/**
 * Helper function to send updates to other users in the game when a new user joins the game.
 * @param {WebSocketClient} ws WebSocketClient
 * @param {string} connectionId connection id
 * @param {Game} updatedGame updated game object
 */
const joinGameSendUpdates = async (ws: WebSocketClient, connectionId: string, updatedGame: Game): Promise<void> => {
  // Send IN_GAME_MESSAGE to other users in the game
  const connectionIds = updatedGame.users.map((user) => user.connectionId);
  await broadcastInGameMessage(ws, connectionId, WebSocketActionsEnum.JOIN_GAME, connectionIds);

  // Send IN_GAME_UPDATE with the updated users list to other users in the game
  await broadcastInGameUpdate(ws, connectionId, updatedGame.users);
};

/* ----------------------------------------------------------------------------
 * Handler
 * ------------------------------------------------------------------------- */

/**
 * Handler for joining a game.
 * @param {WebSocketAPIGatewayEvent} event Websocket API gateway event
 */
export const handler: Handler = async (event: WebSocketAPIGatewayEvent): Promise<LambdaResponse> => {
  // Logger
  Logger.createLogTitle('onJoinGame.ts');

  // Parse event
  const { connectionId } = event.requestContext;
  const body: LambdaEventBody = JSON.parse(event.body);
  const { payload }: { payload: LambdaEventBodyPayloadOptions } = body;
  const gameId = payload.gameId as string;

  const ws = new WebSocketClient(event.requestContext);
  try {
    /**
     * Join game
     * 1. Add the current user to a game
     * 2. Add gameId as a reference to the current user
     */
    const updatedGame = await joinGame(ws, connectionId, gameId);

    /**
     * Send update to users
     * 1. Send IN_GAME_MESSAGE to other users in the game
     * 2. Send IN_GAME_UPDATE with the updated users list to other users in the game
     */
    if (updatedGame) await joinGameSendUpdates(ws, connectionId, updatedGame);

    return response(200, 'Joined game successfully');
  } catch (err) {
    // Send failure response
    const emptyGameResponse = createJoinGameResponse(undefined);
    const wsResponse = failedWebSocketResponse(emptyGameResponse, JSON.stringify(err));
    await ws.send(wsResponse, connectionId);

    return response(500, err);
  }
};
