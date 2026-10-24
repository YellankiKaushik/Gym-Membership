// Keep resource acquisition inside the cleanup boundary, including listen/launch failures.
export async function withCaptureResources({createServer, launchBrowser}, capture) {
  let server;
  let browser;
  let result;
  const errors = [];
  try {
    server = await createServer();
    await server.listen();
    browser = await launchBrowser();
    result = await capture(browser);
  } catch (error) {
    errors.push(error);
  } finally {
    // Attempt both closes independently: a browser-close failure must not leak Vite.
    for (const resource of [browser, server]) {
      if (resource) {
        try {await resource.close();} catch (error) {errors.push(error);}
      }
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Capture failed; all resource cleanup was attempted');
  return result;
}
