import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { AuthService } from '../auth.service';
import { OAuthStateStore } from '../oauth-state-store';

// passport-github2's typings don't model the extra fields `allRawEmails`
// adds to profile.emails (primary/verified) — they exist at runtime but
// aren't in @types/passport-github2, so this is typed by hand.
interface GithubRawEmail {
  value: string;
  primary?: boolean;
  verified?: boolean;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly authService: AuthService) {
    super({
      // Falls back to placeholders so the app can boot before the GitHub
      // OAuth app is registered; real values are required for GET /auth/github
      // to actually work, not just to construct the strategy.
      clientID: process.env.GITHUB_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'not-configured',
      callbackURL: process.env.GITHUB_CALLBACK_URL || 'not-configured',
      scope: ['user:email'],
      allRawEmails: true,
      // Cookie-backed state store mitigates OAuth login CSRF — see
      // OAuthStateStore for why this isn't the built-in session-based one.
      store: new OAuthStateStore('github_oauth_state'),
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    // profile.emails only carries `value`/`type` per @types/passport-github2,
    // but `allRawEmails: true` (set above) adds `primary`/`verified` at
    // runtime that the types don't model — hence the manual cast.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- false positive: removing this makes .primary/.verified below a tsc error
    const emails = profile.emails as unknown as GithubRawEmail[] | undefined;
    const primary = emails?.find((email) => email.primary) ?? emails?.[0];
    if (!primary) {
      throw new UnauthorizedException('GitHub account has no email');
    }
    return this.authService.findOrCreateUser({
      provider: 'github',
      providerAccountId: String(profile.id),
      email: primary.value,
      emailVerified: primary.verified === true,
      displayName: profile.displayName || profile.username || primary.value,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    });
  }
}
