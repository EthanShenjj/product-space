import { Sandbox } from '@vercel/sandbox';
import { getSandboxPackages } from '../src/server/sandbox/registry';

async function main() {
  const packages = getSandboxPackages();
  if (!packages.length) {
    throw new Error('SANDBOX_TOOL_REGISTRY must declare at least one tool install package before creating a snapshot.');
  }

  const sandbox = await Sandbox.create({
    runtime: 'node24',
    timeout: 5 * 60_000,
    resources: { vcpus: 1 },
    // Snapshot setup is the only phase that needs package-registry network access.
    networkPolicy: { allow: ['registry.npmjs.org'] },
    env: { NO_COLOR: '1' },
  });

  try {
    const install = await sandbox.runCommand({
      cmd: 'npm',
      args: ['install', '--global', '--omit=dev', ...packages],
      cwd: '/vercel/sandbox',
    });
    const stderr = await install.stderr();
    if (install.exitCode !== 0) throw new Error(`Sandbox package installation failed: ${stderr.slice(0, 1_000)}`);

    const snapshot = await sandbox.snapshot({ expiration: 0 });
    console.log(`SANDBOX_SNAPSHOT_ID=${snapshot.snapshotId}`);
    console.log(`Installed ${packages.length} package(s) into isolated sandbox snapshot.`);
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
