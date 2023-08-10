export function renderOutput(walletOutputDataArr) {
  setInterval(() => printWalletsInfo(walletOutputDataArr), 500);
}

function printWalletsInfo(walletOutputDataArr) {
  console.clear();
  console.table(walletOutputDataArr);
  isProgramCompleted(walletOutputDataArr);
}

function isProgramCompleted(walletOutputDataArr) {
  for (let i = 0; i < walletOutputDataArr.length; i++) {
    if (walletOutputDataArr[i].status === 0) return;
  }
  process.exit();
}
