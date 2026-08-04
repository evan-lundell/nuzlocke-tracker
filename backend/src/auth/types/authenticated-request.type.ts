import { Request } from 'express';
import { User } from '../../../generated/prisma/client';
import { JwtPayload } from './jwt-payload.type';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

// req.user during the OAuth callback route is the full User returned by the
// strategy's validate(), before it's ever reduced to a JwtPayload.
export interface OAuthCallbackRequest extends Request {
  user: User;
}
