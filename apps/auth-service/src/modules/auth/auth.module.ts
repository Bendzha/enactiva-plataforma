import { Module } from '@nestjs/common';
import { IdentityCliente } from '../../identity.cliente.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, IdentityCliente],
})
export class AuthModule {}
