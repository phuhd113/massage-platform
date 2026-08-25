import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from './current-user.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        header.slice('Bearer '.length),
      );
      (request as Request & { user?: JwtPayload }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Access token không hợp lệ hoặc đã hết hạn');
    }
  }
}
