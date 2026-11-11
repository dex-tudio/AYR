// Runs a system action (copy, open settings, open a URL). A throw or a false result becomes the given message, never a silent success.
export async function runSystemAction(action: () => Promise<unknown> | unknown, failure: string): Promise<string | null> {
  try {
    return (await action()) === false ? failure : null;
  } catch {
    return failure;
  }
}
