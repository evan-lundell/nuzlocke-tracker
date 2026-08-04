import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    super({
      // Falls back to placeholders so the app can boot before the Google
      // OAuth app is registered; real values are required for GET /auth/google
      // to actually work, not just to construct the strategy.
      clientID: process.env.GOOGLE_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not-configured',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'not-configured',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const email = profile.emails?.[0];
    if (!email) {
      throw new UnauthorizedException('Google account has no email');
    }
    return this.authService.findOrCreateUser({
      provider: 'google',
      providerAccountId: profile.id,
      email: email.value,
      emailVerified: email.verified === true,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    });
  }
}
