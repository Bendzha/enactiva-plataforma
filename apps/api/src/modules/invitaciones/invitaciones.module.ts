import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InvitacionesController } from './invitaciones.controller.js';
import { InvitacionesService } from './invitaciones.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InvitacionesController],
  providers: [InvitacionesService],
})
export class InvitacionesModule {}
