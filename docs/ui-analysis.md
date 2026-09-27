# 格鬥遊戲 UI 分析（「UI 的部分 在網路上搜尋格鬥遊戲去分析」）

看的東西：Pinterest 上的格鬥遊戲 HUD 合集（Tekken 7 的 life bars 圖表、KOF XIII 對戰截圖、KOF 2002／2003 的對戰與選角畫面、
Street Fighter IV 截圖、幾套 UI kit），以及文章：SuperCombo Wiki 的 HUD 條目、Game UI Database 的 Player Vitals／Character
Select 分類、Argentics 與 Sunstrike 的 HUD 設計指南、NeoGAF「Best and Worst Fighting Game UIs」討論。

## 對戰 HUD 的共同做法

| 元素 | 共同做法 | 我們原本 | 改成 |
| --- | --- | --- | --- |
| 血條 | 上方兩條，**往中央扣**（一眼看誰快死）；內側端斜切；上緣一條亮光；剛扣的血量留一段紅色殘影再縮 | 平直的黃條、無殘影 | `hbar()`：斜切內側端、頂部亮光、底部暗邊、紅色殘影（`hpShown` 以 5%/幀追上） |
| 頭像 | 在外側端、有框；名字在頭像下方的牌子上 | 頭像無框，名字在血條下 | 頭像加角色色的 1 px 框；名字放在頭像下方 124×13 的暗牌上，牌底一條角色色線 |
| 回合勝標 | 在血條靠中央的一端，小圓點／小方塊 | 在頭像旁 | 移到血條內側端下方（y 20），亮起時帶一點高光 |
| 計時器 | 中央上方，放在一個徽章／六角框裡；回合數在它下面 | 光禿的數字 | 40×24 的切角徽章（金框）＋回合數小牌 |
| 超必殺量表 | **在畫面下方兩角**，不在血條旁；有分段刻度、存量數字徽章、滿了閃 MAX | 貼在血條下方的 2 px 細線 | 移到下方兩角：96×6、四段刻度、存量徽章（0／1）、滿時整條與徽章閃白＋「MAX」 |
| 防禦／特殊量表 | KOF 的 guard gauge 貼在血條下 | 部位耐久圖示列 | 保留（這是本作的特色），加 1 px 亮邊讓它像一列小框 |
| 連段數 | 靠自己那一側、大字 | 已有 | 不動 |

原則（來自文章）：玩家要掃視的距離越短越好——所以血條往中央扣、超必殺量表在有空間的畫面下方、同一側的資訊排成一列。

## 選角畫面的共同做法

- 中央或下方一格格的頭像格（KOF 2002／2003：右側的格子＋左側大立繪＋名字牌＋「SELECTION／OK／CANCEL」提示列）。
- 游標用玩家色的框，選定時大立繪換人、名字牌換字；未開放的格子用問號或剪影。
- 我們的版本（依使用者給的手遊選角參考）：左半大半身圖、右邊三個圓形頭像（一個開放、兩個問號）、名字牌與身高／部位資訊、
  「◀▶ 選擇 Z 決定 ESC 返回」提示——結構與上述一致，這次只換了圖：半身圖改用 3D 全身圖裁的胸像，圓形頭像改用像素全身圖的臉。

## 套到所有畫面的介面語言

| 元件 | 做法 | 用在 |
| --- | --- | --- |
| 標題帶 `uiHeader` | 上方 24 px 的暗帶、上下金線、置中的畫面名、右側玩家標籤（玩家色） | 選角、選場景 |
| 提示列 `uiPrompt` | 下方 20 px 的暗帶＋金線、按鍵提示置中（KOF 的 SELECTION／OK／CANCEL 列） | 標題、選角、選場景 |
| 切角牌 `badge` | 深底、金框、四角切 2 px | 標題的選單牌、計時器徽章、存量徽章 |
| 游標 | 玩家色的直條＋淡金底（選單）、金環（頭像）、金框＋光暈（縮圖） | 標題、選角、選場景 |
| 大字幕帶 `uiBand` | 半透明暗帶＋上下金線 | ROUND、FIGHT!、K.O.、WINS 結算、PAUSE |

## 來源

- SuperCombo Wiki — Fighting Layer/HUD: https://wiki.supercombo.gg/w/Fighting_Layer/HUD
- Game UI Database — Player Vitals: https://www.gameuidatabase.com/index.php?tag=83&scrn=133 ／ Character Select: https://www.gameuidatabase.com/index.php?scrn=41
- Argentics — Game HUD Design: https://www.argentics.io/game-hud-design
- Sunstrike Studios — HUD in Video Games: https://sunstrikestudios.com/en/blog/HUD_design_in_games/
- NeoGAF — Best and Worst Fighting Game UIs: https://www.neogaf.com/threads/best-and-worst-fighting-game-uis.765353/
- Wikipedia — HUD (video games): https://en.wikipedia.org/wiki/HUD_(video_games)
- Pinterest 搜尋「fighting game HUD health bar ui」「KOF 98 HUD pixel art screenshot」的截圖（只在瀏覽器裡看）
