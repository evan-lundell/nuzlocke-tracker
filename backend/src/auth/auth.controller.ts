import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import type { User } from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import { AUTH_COOKIE_NAME } from './auth.constants';
import { getAuthCookieOptions } from './cookie-options';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { OAuthCallbackRequest } from './types/authenticated-request.type';
import type { JwtPayload } from './types/jwt-payload.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport intercepts the request and redirects to Google before this
    // handler body ever runs.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: OAuthCallbackRequest, @Res() res: Response) {
    await this.completeLogin(req.user, res);
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubLogin() {
    // Passport intercepts the request and redirects to GitHub before this
    // handler body ever runs.
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: OAuthCallbackRequest, @Res() res: Response) {
    await this.completeLogin(req.user, res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.findById(user.sub);
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
    res.status(204).send();
  }

  private async completeLogin(user: User, res: Response) {
    const token = await this.authService.signToken(user);
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    res.redirect(process.env.FRONTEND_ORIGIN ?? '/');
  }
}
