// Track table rendering information
let firstRender = true;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Start rendering the output table and refreshing it periodically
 * @param walletOutputDataArr - Array of wallet data to display
 */
export function renderOutput(walletOutputDataArr) {
  // Clear any existing intervals to prevent multiple renders
  if (intervalId) clearInterval(intervalId);

  // Initial render
  printWalletsInfo(walletOutputDataArr);

  // Set up periodic refresh
  intervalId = setInterval(() => printWalletsInfo(walletOutputDataArr), 500);
}

/**
 * Print the wallet information table in-place
 * @param walletOutputDataArr - Array of wallet data to display
 */
function printWalletsInfo(walletOutputDataArr) {
  console.clear();
  // Clear the screen first if it's not the first render
  if (!firstRender) {
    // Move to the top of the terminal
    process.stdout.write('\u001B[0;0H');
    // Clear from cursor to end of screen
    process.stdout.write('\u001B[J');
  } else {
    // After first render, we'll clear and rewrite
    firstRender = false;
  }

  // Add a timestamp header
  console.log(`Wallet Status - Updated: ${new Date().toLocaleTimeString()}`);
  console.log('-'.repeat(50));

  // Print the table
  console.table(walletOutputDataArr);

  // Check if the program should exit
  isProgramCompleted(walletOutputDataArr);
}

/**
 * Check if all wallets have completed their tasks
 * @param walletOutputDataArr - Array of wallet data to check
 */
function isProgramCompleted(walletOutputDataArr) {
  for (let i = 0; i < walletOutputDataArr.length; i++) {
    if (walletOutputDataArr[i].status === 0) return;
  }
  // All wallets completed, stop the program
  if (intervalId) clearInterval(intervalId);
  process.exit();
}
