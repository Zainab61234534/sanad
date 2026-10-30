import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AppCache {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  private async version(group: string) { return (await this.cache.get<number>(`v:${group}`)) ?? 1; }

  /** يقرأ من الكاش أو ينفّذ loader ويخزّن. استثناء loader (مثل 404) لا يُخزَّن. */
  async wrap<T>(group: string, suffix: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const key = `${group}:v${await this.version(group)}:${suffix}`; // الإصدار يُقرأ قبل التحميل
    const hit = await this.cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
    const fresh = await loader();
    await this.cache.set(key, fresh, ttlMs);
    return fresh;
  }

  /** إبطال كل مفاتيح المجموعة: عمر مفتاح الإصدار (يوم) أطول من أي TTL فلا مفتاح قديم يعود للحياة */
  async bump(group: string) { await this.cache.set(`v:${group}`, (await this.version(group)) + 1, 86_400_000); }
}