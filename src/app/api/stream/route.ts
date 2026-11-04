import { publicLeaderboard } from "@/lib/publicBoard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Serverless hosts (e.g. Vercel) cap how long one request may run, so each stream ends itself after
// STREAM_MAX_MS; browsers' EventSource reconnects on its own (after the `retry` delay below).
const STREAM_MAX_MS = Number(process.env.STREAM_MAX_MS ?? (process.env.VERCEL ? 50_000 : 0));

// Server-sent events: pushes the public leaderboard whenever it changes (checked every 2.5s).
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let last = "";
  const stream = new ReadableStream({
    async start(controller) {
      const push = async () => {
        try {
          const data = JSON.stringify(await publicLeaderboard());
          if (data !== last) {
            last = data;
            controller.enqueue(encoder.encode(`event: leaderboard\ndata: ${data}\n\n`));
          } else {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          }
        } catch {
          controller.enqueue(encoder.encode(`event: error\ndata: {}\n\n`));
        }
      };
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      await push();
      timer = setInterval(push, 2500);
      if (STREAM_MAX_MS > 0) {
        setTimeout(() => { clearInterval(timer); try { controller.close(); } catch { /* already closed */ } }, STREAM_MAX_MS);
      }
      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
