import { Global, Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { AppCache } from "./app-cache.service.js";

@Global()
@Module({ imports: [CacheModule.register({ ttl: 60_000 })], providers: [AppCache], exports: [AppCache] })
export class AppCacheModule {}