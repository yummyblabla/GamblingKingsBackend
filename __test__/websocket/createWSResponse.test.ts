import {
  createGameResponse,
  createGameUpdateResponse,
  createGetAllGamesResponse,
  createGetAllUsersResponse,
  createInGameMessageResponse,
  createInGameUpdateResponse,
  createJoinGameResponse,
  createLeaveResponse,
  createLoginFailureResponse,
  createLoginSuccessResponse,
  createSendMessageResponse,
  createUserUpdateResponse,
  failedWebSocketResponse,
  successWebSocketResponse,
  createStartGameResponse,
  createGameStartResponse,
  createGamePageLoadResponse,
  createDrawTileResponse,
  createPlayTileResponse,
} from '../../src/websocket/createWSResponse';
import {
  CreateGamePayload,
  GameUpdatePayload,
  GetAllGamesPayload,
  GetAllUsersPayload,
  InGameUpdatePayload,
  JoinGamePayload,
  LeaveGamePayload,
  SendMessagePayload,
  UserUpdatePayload,
} from '../../src/types/payload';
import {
  FAKE_CONNECTION_ID1,
  TEST_GAME_OBJECT1,
  TEST_GAME_OBJECT2,
  TEST_USER_OBJECT1,
  TEST_USER_OBJECT2,
  TEST_USER_OBJECT3,
} from '../testConstants';
import { WebSocketActionsEnum } from '../../src/enums/WebSocketActionsEnum';
import { GameStatesEnum, UserStatesEnum } from '../../src/enums/states';
import { WebSocketResponse } from '../../src/types/response';
import { Game } from '../../src/models/Game';

// User
const TEST_USERS_LIST = [TEST_USER_OBJECT1, TEST_USER_OBJECT2, TEST_USER_OBJECT3];

// Game
const FAKE_GAME_ID1 = 'fake-game-id-1';
const FAKE_GAME_ID2 = 'fake-game-id-2';
const TEST_GAME_1 = { gameId: FAKE_GAME_ID1, ...TEST_GAME_OBJECT1 };
const TEST_GAME_2 = { gameId: FAKE_GAME_ID2, ...TEST_GAME_OBJECT2 };
const TEST_GAMES_LIST = [TEST_GAME_1, TEST_GAME_2];

/* ----------------------------------------------------------------------------
 * User Related Responses
 * ------------------------------------------------------------------------- */

describe('test createGetAllUsersResponse', () => {
  const testGetAllUsersPayload: GetAllUsersPayload = {
    users: TEST_USERS_LIST,
  };
  const expectedResponse: WebSocketResponse = {
    action: WebSocketActionsEnum.GET_ALL_USERS,
    payload: {
      users: TEST_USERS_LIST,
    },
  };

  test('it should get the correct response', () => {
    const response = createGetAllUsersResponse(testGetAllUsersPayload);

    expect(response.payload.users).toHaveLength(3);
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createUserUpdateResponse', () => {
  const testUserUpdatePayload: UserUpdatePayload = {
    user: TEST_USER_OBJECT1,
    state: UserStatesEnum.CONNECTED,
  };
  const expectedResponse: WebSocketResponse = {
    action: WebSocketActionsEnum.USER_UPDATE,
    payload: {
      user: TEST_USER_OBJECT1,
      state: UserStatesEnum.CONNECTED,
    },
  };

  test('it should get the correct response', () => {
    const response = createUserUpdateResponse(testUserUpdatePayload);

    expect(response.payload.user).toStrictEqual(TEST_USER_OBJECT1);
    expect(response).toStrictEqual(expectedResponse);
  });
});

/* ----------------------------------------------------------------------------
 * Game Related Response
 * ------------------------------------------------------------------------- */

describe('test createGetAllGamesResponse', () => {
  const testGetAllGamesPayload: GetAllGamesPayload = {
    games: TEST_GAMES_LIST,
  };
  const expectedResponse: WebSocketResponse = {
    action: WebSocketActionsEnum.GET_ALL_GAMES,
    payload: {
      games: TEST_GAMES_LIST,
    },
  };

  test('it should get the correct response', () => {
    const response = createGetAllGamesResponse(testGetAllGamesPayload);

    expect(response.payload.games).toHaveLength(2);
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createGameResponse', () => {
  test('it should get the correct response', () => {
    const testCreateGamePayload: CreateGamePayload = {
      game: TEST_GAME_1,
    };
    const expectedResponse: WebSocketResponse = {
      action: WebSocketActionsEnum.CREATE_GAME,
      payload: {
        game: TEST_GAME_1,
      },
    };
    const response = createGameResponse(testCreateGamePayload);

    expect(response.payload.game).toStrictEqual(TEST_GAME_1);
    expect(response).toStrictEqual(expectedResponse);
  });

  test('it should return an empty object if the game is undefined', () => {
    const testCreateGamePayload: CreateGamePayload = {
      game: {} as Game,
    };
    const expectedResponse: WebSocketResponse = {
      action: WebSocketActionsEnum.CREATE_GAME,
      payload: {
        game: {} as Game,
      },
    };
    const response = createGameResponse(testCreateGamePayload);

    expect(response.payload.game).toStrictEqual({});
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createJoinGameResponse', () => {
  test('it should get the correct response', () => {
    const testJoinGamePayload: JoinGamePayload = {
      game: TEST_GAME_1,
    };
    const expectedResponse: WebSocketResponse = {
      action: WebSocketActionsEnum.JOIN_GAME,
      payload: {
        game: TEST_GAME_1,
      },
    };
    const response = createJoinGameResponse(testJoinGamePayload);

    expect(response.payload.game).toStrictEqual(TEST_GAME_1);
    expect(response).toStrictEqual(expectedResponse);
  });

  test('return an empty object if the game is undefined', () => {
    const testJoinGamePayload: JoinGamePayload = {
      game: {} as Game,
    };
    const expectedResponse: WebSocketResponse = {
      action: WebSocketActionsEnum.JOIN_GAME,
      payload: {
        game: {} as Game,
      },
    };
    const response = createJoinGameResponse(testJoinGamePayload);

    expect(response.payload.game).toStrictEqual({});
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createLeaveGameResponse', () => {
  const testLeaveGamePayload: LeaveGamePayload = {
    game: TEST_GAME_1,
  };
  const expectedResponse: WebSocketResponse = {
    action: WebSocketActionsEnum.LEAVE_GAME,
    payload: {
      game: TEST_GAME_1,
    },
  };

  test('it should get the correct response', () => {
    const response = createLeaveResponse(testLeaveGamePayload);

    expect(response.payload.game).toStrictEqual(TEST_GAME_1);
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createGameUpdateResponse', () => {
  const testGameUpdatePayload: GameUpdatePayload = {
    game: TEST_GAME_1,
    state: GameStatesEnum.CREATED,
  };
  const expectedResponse: WebSocketResponse = {
    action: WebSocketActionsEnum.GAME_UPDATE,
    payload: {
      game: TEST_GAME_1,
      state: GameStatesEnum.CREATED,
    },
  };

  test('it should get the correct response', () => {
    const response = createGameUpdateResponse(testGameUpdatePayload);

    expect(response.payload.game).toStrictEqual(TEST_GAME_1);
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createInGameUpdateResponse', () => {
  const testInGameUpdatePayload: InGameUpdatePayload = {
    users: TEST_USERS_LIST,
  };
  const expectedResponse: WebSocketResponse = {
    action: WebSocketActionsEnum.IN_GAME_UPDATE,
    payload: {
      users: TEST_USERS_LIST,
    },
  };

  test('it should get the correct response', () => {
    const response = createInGameUpdateResponse(testInGameUpdatePayload);

    expect(response.payload.users).toHaveLength(3);
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createInGameMessageResponse', () => {
  const username = 'test username';
  const message = 'test message';

  test('it should get the correct response', () => {
    const response = createInGameMessageResponse(username, message);

    expect(response.payload.username).toStrictEqual(username);
    expect(response.payload.message).toStrictEqual(message);
    expect(response.payload.time).not.toBeUndefined();
  });
});

describe('test createStartGameResponse', () => {
  test('it should get the correct response', () => {
    const response = createStartGameResponse();
    const expectedResponse = {
      action: WebSocketActionsEnum.START_GAME,
      payload: {},
    };

    expect(response.payload).toStrictEqual({});
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createGamePageLoadResponse', () => {
  test('it should get the correct response', () => {
    const response = createGamePageLoadResponse();
    const expectedResponse = {
      action: WebSocketActionsEnum.GAME_PAGE_LOAD,
      payload: {},
    };

    expect(response.payload).toStrictEqual({});
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createGameStartResponse', () => {
  test('it should get the correct response', () => {
    const testTiles = [''];
    const response = createGameStartResponse({ tiles: testTiles, selfPlayedTiles: [], currentIndex: 52 });
    const expectedPayload = {
      tiles: testTiles,
      selfPlayedTiles: [],
      currentIndex: 52,
    };
    const expectedResponse = {
      action: WebSocketActionsEnum.GAME_START,
      payload: expectedPayload,
    };

    expect(response.payload).toStrictEqual(expectedPayload);
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createDrawTileResponse', () => {
  test('it should get the correct response', () => {
    const testTile = '1_DOT';
    const payload = { tile: testTile, currentIndex: 50 };
    const response = createDrawTileResponse(payload);
    const expectedResponse = {
      action: WebSocketActionsEnum.DRAW_TILE,
      payload,
    };

    expect(response.payload).toStrictEqual(payload);
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createPlayTileResponse', () => {
  test('it should get the correct response', () => {
    const testTile = '2_DOT';
    const response = createPlayTileResponse({ tile: testTile, connectionId: FAKE_CONNECTION_ID1 });
    const expectedPayload = {
      tile: testTile,
      connectionId: FAKE_CONNECTION_ID1,
    };
    const expectedResponse = {
      action: WebSocketActionsEnum.PLAY_TILE,
      payload: expectedPayload,
    };

    expect(response.payload).toStrictEqual(expectedPayload);
    expect(response).toStrictEqual(expectedResponse);
  });
});

/* ----------------------------------------------------------------------------
 * Success and Failure Response
 * ------------------------------------------------------------------------- */
describe('test successWebSocketResponse', () => {
  const testPayload: GameUpdatePayload = {
    game: TEST_GAME_1,
    state: GameStatesEnum.CREATED,
  };
  const expectedResponse: WebSocketResponse = {
    action: WebSocketActionsEnum.GAME_UPDATE,
    payload: {
      success: true,
      game: TEST_GAME_1,
      state: GameStatesEnum.CREATED,
    },
  };

  test('it should get the correct response', () => {
    const response = successWebSocketResponse(createGameUpdateResponse(testPayload));

    expect(response.payload.success).toBeTruthy();
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test failedWebSocketResponse', () => {
  const testErrorMsg = 'test error message';
  const testPayload: GameUpdatePayload = {
    game: TEST_GAME_1,
    state: GameStatesEnum.CREATED,
  };
  const expectedResponse: WebSocketResponse = {
    action: WebSocketActionsEnum.GAME_UPDATE,
    payload: {
      success: false,
      error: testErrorMsg,
      game: TEST_GAME_1,
      state: GameStatesEnum.CREATED,
    },
  };

  test('it should get the correct response', () => {
    const response = failedWebSocketResponse(createGameUpdateResponse(testPayload), testErrorMsg);

    expect(response.payload.success).toBeFalsy();
    expect(response.payload.error).toStrictEqual(testErrorMsg);
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createLoginSuccessResponse', () => {
  const expectedResponse: WebSocketResponse = {
    action: WebSocketActionsEnum.LOGIN_SUCCESS,
    payload: {
      success: true,
    },
  };

  test('it should get the correct response', () => {
    const response = createLoginSuccessResponse();

    expect(response.payload.success).toBeTruthy();
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createLoginFailureResponse', () => {
  const errorMsg = 'test error msg';
  const expectedResponse: WebSocketResponse = {
    action: WebSocketActionsEnum.LOGIN_SUCCESS,
    payload: {
      success: false,
      error: errorMsg,
    },
  };

  test('it should get the correct response', () => {
    const response = createLoginFailureResponse(errorMsg);

    expect(response.payload.success).toBeFalsy();
    expect(response.payload.error).toStrictEqual(errorMsg);
    expect(response).toStrictEqual(expectedResponse);
  });
});

describe('test createSendMessageResponse', () => {
  const username = 'testing username';
  const message = 'test msg';
  const testCreateSendMessagePayload: SendMessagePayload = {
    username,
    message,
  };

  test('it should get the correct response', () => {
    const response = createSendMessageResponse(testCreateSendMessagePayload);

    expect(response.payload.username).toStrictEqual(username);
    expect(response.payload.message).toStrictEqual(message);
    expect(response.payload.time).not.toBeUndefined();
  });
});
