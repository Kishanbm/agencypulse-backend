import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthCleanupTask } from './auth-cleanup.task';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtModule registered without a secret — TokenService uses ConfigService
    // to sign/verify with the secret directly, giving per-call control.
    JwtModule.register({}),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    AuthCleanupTask, // daily cron: deletes expired/old-revoked refresh tokens
  ],
  exports: [
    JwtAuthGuard,    // exported for global APP_GUARD registration in AppModule
    RolesGuard,      // exported for global APP_GUARD registration in AppModule
    TokenService,    // exported for BullMQ workers that need to verify tokens (Phase 4)
    PasswordService,
  ],
})
export class AuthModule {}
