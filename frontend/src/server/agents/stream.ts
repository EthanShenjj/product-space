export function encodeTextStream(source: AsyncIterable<string>) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const value of source) {
          if (value) controller.enqueue(encoder.encode(value));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
