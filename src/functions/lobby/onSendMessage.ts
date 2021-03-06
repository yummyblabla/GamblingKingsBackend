import { Handler } from 'aws-lambda';
import { response } from '../../utils/responseHelper';
import { WebSocketClient } from '../../websocket/WebSocketClient';
import { Logger } from '../../utils/Logger';
import { LambdaEventBody, WebSocketAPIGatewayEvent } from '../../types/event';
import { LambdaEventBodyPayloadOptions } from '../../types/payload';
import { LambdaResponse } from '../../types/response';
import { broadcastMessage } from '../../websocket/broadcast/messageBroadcast';

/**
 * Handler for sending a message to all the users (or connections).
 * @param {WebSocketAPIGatewayEvent} event Websocket API gateway event
 */
export const handler: Handler = async (event: WebSocketAPIGatewayEvent): Promise<LambdaResponse> => {
  Logger.createLogTitle('onSendMessage.ts');

  const body = JSON.parse(event.body) as LambdaEventBody;
  const { payload }: { payload: LambdaEventBodyPayloadOptions } = body;

  // Broadcast message
  const { username, message } = payload;

  const ws = new WebSocketClient(event.requestContext);
  try {
    if (username && message) {
      const wsResponse = await broadcastMessage(ws, username, message);
      return response(200, JSON.stringify(wsResponse));
    }

    return response(400, 'Message attribute cannot be empty');
  } catch (err) {
    return response(500, err);
  }
};
