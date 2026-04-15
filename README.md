# LogiChain Trace

Logistika va ta'minot zanjiri uchun blockchain loyiha. Mahsulot tizimga kiritiladi, status va lokatsiyasi kuzatiladi, egasi almashtiriladi, haqiqiyligi tekshiriladi va butun tarix audit qilinadi.

## Imkoniyatlar

- Mahsulotni birinchi marta blockchain reyestrga kiritish.
- Mahsulot qayerdaligini status va lokatsiya orqali kuzatish.
- Yetkazib berish holatini yangilash: omborda, yo'lda, bojxonada, yetkazildi, bekor qilindi.
- Mahsulot haqiqiyligini tekshirish va qalbaki/shubhali deb belgilash.
- Egani o'zgartirish: ishlab chiqaruvchi -> distribyutor -> sotuvchi.
- Ta'minot zanjiri tarixini audit qilish.
- Demo Ledger rejimi: free static deployda ham MetaMasksiz ishlaydi.
- Real blockchain rejimi: `LogisticsChain.sol` deploy qilinganda Web3.js va MetaMask orqali ishlaydi.

## Ishga tushirish

```bash
npm install
npm run dev
```

Brauzer:

```text
http://127.0.0.1:5177
```

## Lokal blockchain bilan

1. Birinchi terminal:

```bash
npm run chain
```

2. Ikkinchi terminal:

```bash
npm run deploy:local
npm run dev
```

3. MetaMask tarmog'i:

```text
RPC URL: http://127.0.0.1:8545
Chain ID: 1337
Currency: ETH
```

Ganache terminalidagi private keylardan birini MetaMask'ga import qiling.

## Public testnet deploy

PowerShell:

```powershell
$env:RPC_URL="https://your-testnet-rpc.example"
$env:NETWORK_NAME="Sepolia"
$env:PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
npm run deploy:network
npm run build
```

`public/contracts.json` deploy manzilini saqlaydi. Private key GitHub'ga yuklanmasin.

## GitHub'ga yuklash

```bash
git init
git add .
git commit -m "Build LogiChain logistics blockchain system"
git branch -M main
git remote add origin https://github.com/USERNAME/logistics-blockchain-system.git
git push -u origin main
```

## Free deploy

GitHub Pages:

- Repository `Settings -> Pages -> Source: GitHub Actions`.
- `.github/workflows/deploy-pages.yml` tayyor.

Netlify:

- Build command: `npm run build`
- Publish directory: `dist`
- `netlify.toml` tayyor.

Vercel:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Muhim fayllar

- `contracts/LogisticsChain.sol` - smart contract.
- `scripts/compile.mjs` - ABI va artifact yaratadi.
- `scripts/deploy.mjs` - kontraktni RPC tarmoqqa deploy qiladi.
- `src/main.js` - Web3.js va Demo Ledger logikasi.
- `src/style.css` - responsive dashboard dizayni.
- `public/contracts.json` - deploy konfiguratsiyasi.
