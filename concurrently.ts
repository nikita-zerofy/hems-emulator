import concurrently from 'concurrently';

// @ts-ignore // Ignore type issues with concurrently module
const { result } = concurrently([
  {
    command: 'deno task dev:backend',
    name: 'backend',
    cwd: '.',
    prefixColor: 'blue'
  },
  {
    command: 'deno task dev:frontend', 
    name: 'frontend',
    cwd: '.',
    prefixColor: 'green'
  }
], {
  prefix: 'name',
  killOthers: ['failure', 'success'],
  restartTries: 3
});

try {
  await result;
} catch (error) {
  console.error('Development servers failed:', error);
  Deno.exit(1);
}