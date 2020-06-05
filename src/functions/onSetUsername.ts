import { Handler } from 'aws-lambda';
import { setUserName } from '../module/db';
import { WebSocketAPIGatewayEvent, LambdaEventBody } from '../types';
import { response, LambdaResponse } from '../utils/response';

export const handler: Handler = async (event: WebSocketAPIGatewayEvent): Promise<LambdaResponse> => {
  const { connectionId } = event.requestContext;
  const body: LambdaEventBody<string> = JSON.parse(event.body);
  const { payload } = body;
  console.log('Payload', payload);
  const { data } = payload;

  try {
    await setUserName(connectionId, data);

    return response(200, `Set username to ${data}`);
  } catch (err) {
    console.error(err);
    return response(500, err);
  }
};
