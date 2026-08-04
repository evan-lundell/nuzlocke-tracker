export interface OAuthProfileInput {
  provider: 'google' | 'github';
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
}
