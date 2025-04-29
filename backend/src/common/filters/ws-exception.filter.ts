import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

    client.emit('exception', {
      status: 'error',
      message:
        typeof exception.message === 'string'
          ? exception.message
          : 'Internal WebSocket error',
      timestamp: new Date().toISOString(),
    });
  }
}
