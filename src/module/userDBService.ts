import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client';
import { User } from '../models/User';
import { CONNECTIONS_TABLE } from '../constants';
import { DB } from './db';

/* ----------------------------------------------------------------------------
 * User DB Service
 * ------------------------------------------------------------------------- */
/**
 * Save new connection with connectionId to the ConnectionsTable.
 * @param {string} connectionId connectionId from event.requestContext
 * @param {DocumentClient} documentClient DynamoDB DocumentClient
 */
export const saveConnection = async (connectionId: string, documentClient: DocumentClient = DB): Promise<User> => {
  const putParams: DocumentClient.PutItemInput = {
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
    },
    ReturnValues: 'ALL_OLD',
  };

  const res = await documentClient.put(putParams).promise(); // response is empty
  console.log('\nsaveConnection result:', res);

  return { connectionId } as User;
};

/**
 * Remove connection by connectionId from the ConnectionsTable.
 * @param {string} connectionId connectionId from event.requestContext
 * @param {DocumentClient} documentClient
 */
export const deleteConnection = async (
  connectionId: string,
  documentClient: DocumentClient = DB,
): Promise<User | undefined> => {
  const deleteParams: DocumentClient.DeleteItemInput = {
    TableName: CONNECTIONS_TABLE,
    Key: {
      connectionId,
    },
    ReturnValues: 'ALL_OLD',
  };

  const res = await documentClient.delete(deleteParams).promise();
  console.log('\ndeleteConnection result:', res);

  const { Attributes } = res;
  if (!Attributes || Attributes === {}) return undefined;
  return Attributes as User;
};

/**
 * Set username for a connection.
 * @param {string} connectionId connectionId
 * @param {string} username username
 * @param {DocumentClient} documentClient DynamoDB DocumentClient
 */
export const setUsername = async (
  connectionId: string,
  username: string,
  documentClient: DocumentClient = DB,
): Promise<User | undefined> => {
  const updateParams: DocumentClient.UpdateItemInput = {
    TableName: CONNECTIONS_TABLE,
    Key: {
      connectionId,
    },
    // user must exist (to prevent creating a new user if the user does not exist with the given connectionId)
    // and username cannot be empty string
    ConditionExpression: '#connectionIdKey = :connectionIdVal and :usernameVal <> :emptyString',
    UpdateExpression: 'SET #usernameKey = :usernameVal',
    ExpressionAttributeNames: {
      '#connectionIdKey': 'connectionId',
      '#usernameKey': 'username',
    },
    ExpressionAttributeValues: {
      ':connectionIdVal': connectionId,
      ':usernameVal': username,
      ':emptyString': '',
    },
    ReturnValues: 'ALL_NEW',
  };

  const res = await documentClient.update(updateParams).promise();
  console.log('\nsetUserName result:', res);

  const { Attributes } = res;
  if (!Attributes || Attributes === {}) return undefined;
  return Attributes as User;
};

/**
 * Get all connections (rows) from the ConnectionsTable.
 * @param {DocumentClient} documentClient DynamoDB DocumentClient
 */
export const getAllConnections = async (documentClient: DocumentClient = DB): Promise<User[]> => {
  const scanParams: DocumentClient.ScanInput = {
    TableName: CONNECTIONS_TABLE,
    AttributesToGet: ['connectionId', 'username'], // TODO: get less attributes to save read cost
  };

  const res = await documentClient.scan(scanParams).promise();
  console.log('\ngetAllConnections result:', res);

  const { Items } = res;
  if (Items && Items.length > 0) return Items as User[];
  return [];
};

/**
 * Get user attributes by connection Id.
 * @param {string} connectionId connection Id
 * @param {DocumentClient} documentClient DynamoDB DocumentClient
 */
export const getUserByConnectionId = async (
  connectionId: string,
  documentClient: DocumentClient = DB,
): Promise<User | undefined> => {
  const getParam: DocumentClient.GetItemInput = {
    TableName: CONNECTIONS_TABLE,
    Key: {
      connectionId,
    },
  };

  const res = await documentClient.get(getParam).promise();
  console.log('\ngetUserByConnectionId result:', res);

  const { Item } = res;
  if (Item) return Item as User;
  return undefined;
};

export const setGameIdForUser = async (
  connectionId: string,
  gameId: string,
  documentClient: DocumentClient = DB,
): Promise<User | undefined> => {
  const updateParam: DocumentClient.UpdateItemInput = {
    TableName: CONNECTIONS_TABLE,
    Key: {
      connectionId,
    },
    // user must exist (to prevent creating a new user if the user does not exist with the given connectionId)
    // and the gameId attribute must not exist before adding it
    ConditionExpression: '#connectionIdKey = :connectionIdVal AND attribute_not_exists(#gameIdKey)',
    UpdateExpression: 'SET #gameIdKey = :gameIdVal',
    ExpressionAttributeNames: {
      '#connectionIdKey': 'connectionId',
      '#gameIdKey': 'gameId',
    },
    ExpressionAttributeValues: {
      ':connectionIdVal': connectionId,
      ':gameIdVal': gameId,
    },
    ReturnValues: 'ALL_NEW',
  };

  const res = await documentClient.update(updateParam).promise();
  console.log('\nsetGameIdForUser result:', res);

  const { Attributes } = res;
  if (!Attributes || Attributes === {}) return undefined;
  return Attributes as User;
};

export const removeGameIdFromUser = async (
  connectionId: string,
  documentClient: DocumentClient = DB,
): Promise<User | undefined> => {
  const updateParam: DocumentClient.UpdateItemInput = {
    TableName: CONNECTIONS_TABLE,
    Key: {
      connectionId,
    },
    // user must exist (to prevent creating a new user if the user does not exist with the given connectionId)
    // and the gameId attribute must exist before removing it
    ConditionExpression: '#connectionIdKey = :connectionIdVal AND attribute_exists(#gameIdKey)',
    UpdateExpression: 'REMOVE #gameIdKey',
    ExpressionAttributeNames: {
      '#connectionIdKey': 'connectionId',
      '#gameIdKey': 'gameId',
    },
    ExpressionAttributeValues: {
      ':connectionIdVal': connectionId,
    },
    ReturnValues: 'ALL_NEW',
  };

  const res = await documentClient.update(updateParam).promise();
  console.log('\nremoveGameIdFromUser result:', res);

  const { Attributes } = res;
  if (!Attributes || Attributes === {}) return undefined;
  return Attributes as User;
};
