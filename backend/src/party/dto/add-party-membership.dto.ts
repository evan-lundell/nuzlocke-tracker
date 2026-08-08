import { IsUUID } from 'class-validator';

export class AddPartyMembershipDto {
  @IsUUID('7')
  encounterId: string;
}
