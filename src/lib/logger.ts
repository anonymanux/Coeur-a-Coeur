/**
 * Local utility to log errors to the server-side error.log file
 */
export async function logToErrorFile(error: any, context: string) {
  try {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[${context}]`, error);

    await fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { message: errorMsg, stack },
        context,
        timestamp: new Date().toISOString()
      })
    });
  } catch (e) {
    console.error("Failed to send log to server", e);
  }
}
