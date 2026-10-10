import { openStore } from '../../../apps/runtime/src/storage/database';
console.log('READY');
process.stdin.once('data', () => {
  try {
    const store = openStore(process.argv[2]);
    console.log('OWNER');
    setTimeout(() => { store.close(); process.exit(0); }, 1500);
  } catch {
    console.log('DENIED');
    process.exit(0);
  }
});
