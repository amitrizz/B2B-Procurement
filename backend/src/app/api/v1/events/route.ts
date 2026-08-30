import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { eventEmitter } from '@/lib/eventEmitter';

// We must use Node.js runtime for EventEmitter because Edge runtime doesn't fully support Node.js `events` module properly.
export const runtime = 'nodejs';
// This prevents Next.js from caching the SSE stream response
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial connected message so the frontend knows it worked
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      // This listener listens for real-time events specific to this user or their company
      const listener = (data: any) => {
        // Only push the event if it's meant for this user OR their company
        if (
          (data.userId && data.userId === user.id) ||
          (data.companyId && data.companyId === user.companyId) ||
          data.broadcast || // A global event meant for everyone
          user.role === 'PLATFORM_ADMIN' // Platform Admins receive all events to keep their dashboard perfectly in sync
        ) {
          try {
            const payload = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(new TextEncoder().encode(payload));
          } catch (e) {
            console.error('SSE enqueue error', e);
          }
        }
      };

      // Listen to 'app_event'
      eventEmitter.on('app_event', listener);

      // Handle client disconnects to prevent memory leaks
      req.signal.addEventListener('abort', () => {
        eventEmitter.off('app_event', listener);
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
