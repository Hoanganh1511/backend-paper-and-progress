import { Injectable, type MessageEvent } from '@nestjs/common';
import { Subject, filter, interval, map, merge, type Observable } from 'rxjs';

const HEARTBEAT_MS = 25_000;

/**
 * Tells a signed-in reader's open page that their membership changed (their
 * order was paid), so it can say so at once instead of waiting for the next
 * check. It carries no details: the page asks for those itself, with its own
 * login, so nobody can listen in on someone else's account.
 */
@Injectable()
export class MembershipEventsService {
  private changes = new Subject<string>();

  notify(userId: string) {
    this.changes.next(userId);
  }

  /** The stream for one user; a quiet "ping" keeps the connection from being dropped. */
  streamFor(userId: string): Observable<MessageEvent> {
    const changed = this.changes.pipe(
      filter((id) => id === userId),
      map((): MessageEvent => ({
        type: 'membership',
        data: { changed: true },
      })),
    );
    const beat = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: {} })),
    );
    return merge(changed, beat);
  }
}
