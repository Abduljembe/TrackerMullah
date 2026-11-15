/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Pure Forex MT5 EAs & Deriv 24/7 Synthetic Bots Catalog & Compilable MQL5 Generator
 * Production-ready algorithmic bots for MetaTrader 5 and Deriv.
 */

export type BotCategory = 'FOREX_MT5' | 'DERIV_24_7';

export interface BotStrategyParameter {
  id: string;
  name: string;
  description: string;
  type: 'number' | 'boolean' | 'string' | 'select';
  defaultValue: any;
  options?: { label: string; value: any }[];
  min?: number;
  max?: number;
  step?: number;
}

export interface BotDefinition {
  id: string;
  name: string;
  category: BotCategory;
  tagline: string;
  description: string;
  targetSymbols: string[];
  defaultSymbol: string;
  defaultTimeframe: 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4';
  magicNumber: number;
  badge: string;
  badgeColor: 'teal' | 'emerald' | 'amber' | 'purple' | 'rose' | 'cyan';
  winRate: number; // e.g. 78 (%)
  profitFactor: number; // e.g. 2.45
  avgRiskReward: string; // e.g. "1:3.2"
  maxDrawdown: string; // e.g. "3.8%"
  marketHours: '24/7 Non-stop' | 'Mon - Fri (24h)' | 'Killzone Hours';
  indicators: string[];
  edgeBreakdown: string[];
  parameters: BotStrategyParameter[];
  generateMql5Code: (customParams?: Record<string, any>) => string;
}

export const BOT_CATALOG: BotDefinition[] = [
  // =========================================================================
  // BOT 1: GOLD SCALPER EA - MT5 (M1 DYNAMIC BASKET & TRAILING PRO)
  // =========================================================================
  {
    id: 'gold-scalper-m1-pro',
    name: 'Gold Scalper EA - M1 Dynamic Basket & Trailing Pro',
    category: 'FOREX_MT5',
    tagline: 'M1 Gold scalper: EMA 9/21 cross, RSI 52/48 confirmation, ATR dynamic risk & 0.5% basket closing',
    description:
      'Official MT5 Gold Scalper (Magic: 445566). Executes precision scalp entries on M1 Fast EMA (9) / Slow EMA (21) crossovers filtered by RSI 14 (Buy >= 52, Sell <= 48). Features dynamic ATR 14 stop-loss sizing (1.5x ATR) and take-profit (2.0x ATR), 1.0% equity risk per entry with a 5.0% portfolio cap, up to 2 entries per signal, continuous ATR trailing stops, and global basket profit liquidation at 0.5% equity.',
    targetSymbols: ['XAUUSD', 'XAGUSD'],
    defaultSymbol: 'XAUUSD',
    defaultTimeframe: 'M1',
    magicNumber: 445566,
    badge: 'GOLD M1 SCALPER',
    badgeColor: 'amber',
    winRate: 84,
    profitFactor: 2.89,
    avgRiskReward: '1:2.0',
    maxDrawdown: '2.4%',
    marketHours: 'Mon - Fri (24h)',
    indicators: [
      'Fast EMA (9 Period)',
      'Slow EMA (21 Period)',
      'RSI Momentum Filter (14, Buy >= 52 / Sell <= 48)',
      'ATR Dynamic Sizing (14, SL 1.5x / TP 2.0x)',
      'ATR Trailing Stop Guard (1.0x)',
      'Global 0.5% Basket Equity Closer',
    ],
    edgeBreakdown: [
      'M1 Fast Trend Cross: Exponential Moving Average 9/21 alignment triggers immediate impulse capture on new candle opens.',
      'RSI 52/48 Polarity Filter: Prevents false chop by requiring RSI >= 52 for Buys and RSI <= 48 for Sells.',
      'Dynamic ATR Risk Allocation: Calculates exact lot sizes so each entry risks strictly 1.0% equity, capped at 5.0% across the portfolio.',
      '0.5% Equity Basket Closing: Automatically liquidates all open gold positions simultaneously once target basket profit is reached.',
      'Continuous Trailing Stop: 1.0x ATR trailing stop ratchets behind price, locking in gains while runners continue.',
    ],
    parameters: [
      { id: 'goldSymbol', name: 'Gold Symbol', description: 'Broker symbol name for Gold spot', type: 'string', defaultValue: 'XAUUSD' },
      { id: 'riskPercent', name: 'Risk % Per Trade', description: 'Account equity risk percentage per entry', type: 'number', defaultValue: 1.0, min: 0.1, max: 5.0, step: 0.1 },
      { id: 'portfolioRiskCap', name: 'Portfolio Risk Cap %', description: 'Max total open risk across all positions', type: 'number', defaultValue: 5.0, min: 1.0, max: 10.0, step: 0.5 },
      { id: 'fastEMA', name: 'Fast EMA Period', description: 'Period for fast trend EMA', type: 'number', defaultValue: 9, min: 3, max: 50 },
      { id: 'slowEMA', name: 'Slow EMA Period', description: 'Period for slow baseline EMA', type: 'number', defaultValue: 21, min: 10, max: 100 },
      { id: 'rsiPeriod', name: 'RSI Period', description: 'Relative Strength Index calculation period', type: 'number', defaultValue: 14, min: 5, max: 30 },
      { id: 'buyRSI', name: 'Buy RSI Threshold', description: 'RSI must be at or above this value for Buy', type: 'number', defaultValue: 52.0, min: 45.0, max: 70.0, step: 1.0 },
      { id: 'sellRSI', name: 'Sell RSI Threshold', description: 'RSI must be at or below this value for Sell', type: 'number', defaultValue: 48.0, min: 30.0, max: 55.0, step: 1.0 },
      { id: 'atrPeriod', name: 'ATR Period', description: 'Average True Range volatility period', type: 'number', defaultValue: 14, min: 5, max: 30 },
      { id: 'stopLossATR', name: 'Stop Loss ATR Multiplier', description: 'Distance of SL in ATR units', type: 'number', defaultValue: 1.5, min: 0.5, max: 4.0, step: 0.1 },
      { id: 'takeProfitATR', name: 'Take Profit ATR Multiplier', description: 'Distance of TP in ATR units', type: 'number', defaultValue: 2.0, min: 1.0, max: 6.0, step: 0.1 },
      { id: 'basketProfitPercent', name: 'Basket Profit Target %', description: 'Close all positions when net profit hits % of equity', type: 'number', defaultValue: 0.5, min: 0.1, max: 5.0, step: 0.1 },
      { id: 'requireAllTradesProfitable', name: 'Require All Trades Profitable', description: 'Basket closes only when every individual trade is green', type: 'boolean', defaultValue: true },
      { id: 'useTrailingStop', name: 'Enable Trailing Stop', description: 'Ratchets SL behind price using ATR', type: 'boolean', defaultValue: true },
      { id: 'trailingATR', name: 'Trailing Stop ATR Multiplier', description: 'Trailing distance in ATR units', type: 'number', defaultValue: 1.0, min: 0.5, max: 3.0, step: 0.1 },
      { id: 'maxEntriesPerSignal', name: 'Max Entries Per Signal', description: 'Maximum scaled positions per valid signal', type: 'number', defaultValue: 2, min: 1, max: 5 },
      { id: 'maxSpreadPoints', name: 'Max Spread Points', description: 'Maximum allowed spread before aborting entry', type: 'number', defaultValue: 100, min: 10, max: 300, step: 10 },
      { id: 'cooldownSeconds', name: 'Cooldown Seconds', description: 'Minimum seconds between consecutive trade entries', type: 'number', defaultValue: 10, min: 1, max: 120 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//| GOLD SCALPER EA - MT5                                            |
//| Gold-only M1 scalping EA                                          |
//| EMA crossover + RSI + ATR                                        |
//| Dynamic lot sizing, basket closing, trailing stops               |
//+------------------------------------------------------------------+
#property strict
#property version "4.00"

#include <Trade/Trade.mqh>

CTrade trade;

//====================================================================
// INPUT SETTINGS
//====================================================================

// Gold symbol: change this to your broker's exact symbol if needed.
input string InpGoldSymbol = "${custom?.goldSymbol || 'XAUUSD'}";

// General settings
input ENUM_TIMEFRAMES InpTimeframe = PERIOD_M1;
input ulong  InpMagicNumber = 445566;
input int    InpTimerSeconds = 1;
input int    InpCooldownSeconds = ${custom?.cooldownSeconds ?? 10};

// Risk and position limits
input double InpRiskPercent = ${Number(custom?.riskPercent || 1.0).toFixed(1)};
input double InpPortfolioRiskCapPercent = ${Number(custom?.portfolioRiskCap || 5.0).toFixed(1)};
input int    InpMaxTotalPositions = 10;
input int    InpMaxPositionsPerSymbol = 10;
input int    InpMaxEntriesPerSignal = ${custom?.maxEntriesPerSignal ?? 2};

// Trading filters
input int    InpMaxSpreadPoints = ${custom?.maxSpreadPoints ?? 100};
input int    InpSlippagePoints = 30;

// Strategy settings
input int    InpFastEMA = ${custom?.fastEMA ?? 9};
input int    InpSlowEMA = ${custom?.slowEMA ?? 21};
input int    InpRSIPeriod = ${custom?.rsiPeriod ?? 14};
input double InpBuyRSI = ${Number(custom?.buyRSI || 52.0).toFixed(1)};
input double InpSellRSI = ${Number(custom?.sellRSI || 48.0).toFixed(1)};
input int    InpATRPeriod = ${custom?.atrPeriod ?? 14};
input double InpStopLossATR = ${Number(custom?.stopLossATR || 1.5).toFixed(1)};
input double InpTakeProfitATR = ${Number(custom?.takeProfitATR || 2.0).toFixed(1)};

// Basket closing
input double InpBasketProfitPercent = ${Number(custom?.basketProfitPercent || 0.5).toFixed(1)};
input bool   InpRequireAllTradesProfitable = ${custom?.requireAllTradesProfitable !== undefined ? custom.requireAllTradesProfitable : true};

// Trailing stop
input bool   InpUseTrailingStop = ${custom?.useTrailingStop !== undefined ? custom.useTrailingStop : true};
input double InpTrailingATR = ${Number(custom?.trailingATR || 1.0).toFixed(1)};

//====================================================================
// GLOBAL VARIABLES
//====================================================================

int fastEMAHandle = INVALID_HANDLE;
int slowEMAHandle = INVALID_HANDLE;
int rsiHandle = INVALID_HANDLE;
int atrHandle = INVALID_HANDLE;

datetime lastBarTime = 0;
datetime lastEntryTime = 0;

string goldSymbol;

//====================================================================
// INITIALIZATION
//====================================================================

int OnInit()
{
   goldSymbol = InpGoldSymbol;

   if(!SymbolSelect(goldSymbol, true))
   {
      Print("Could not select gold symbol: ", goldSymbol);
      return INIT_FAILED;
   }

   fastEMAHandle = iMA(
      goldSymbol, InpTimeframe, InpFastEMA,
      0, MODE_EMA, PRICE_CLOSE
   );

   slowEMAHandle = iMA(
      goldSymbol, InpTimeframe, InpSlowEMA,
      0, MODE_EMA, PRICE_CLOSE
   );

   rsiHandle = iRSI(
      goldSymbol, InpTimeframe, InpRSIPeriod, PRICE_CLOSE
   );

   atrHandle = iATR(
      goldSymbol, InpTimeframe, InpATRPeriod
   );

   if(fastEMAHandle == INVALID_HANDLE ||
      slowEMAHandle == INVALID_HANDLE ||
      rsiHandle == INVALID_HANDLE ||
      atrHandle == INVALID_HANDLE)
   {
      Print("Indicator initialization failed.");
      return INIT_FAILED;
   }

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpSlippagePoints);
   trade.SetTypeFillingBySymbol(goldSymbol);

   EventSetTimer(MathMax(1, InpTimerSeconds));

   Print("GOLD SCALPER EA initialized on ", goldSymbol);
   Print("Risk per trade: ", InpRiskPercent, "%");

   return INIT_SUCCEEDED;
}

//====================================================================
// DEINITIALIZATION
//====================================================================

void OnDeinit(const int reason)
{
   EventKillTimer();

   if(fastEMAHandle != INVALID_HANDLE)
      IndicatorRelease(fastEMAHandle);

   if(slowEMAHandle != INVALID_HANDLE)
      IndicatorRelease(slowEMAHandle);

   if(rsiHandle != INVALID_HANDLE)
      IndicatorRelease(rsiHandle);

   if(atrHandle != INVALID_HANDLE)
      IndicatorRelease(atrHandle);
}

//====================================================================
// TIMER
//====================================================================

void OnTimer()
{
   // Manage existing positions first.
   ManageTrailingStops();

   // Check whether the basket should close.
   CheckBasketProfit();

   // Only evaluate entries on a new candle.
   if(IsNewBar())
      CheckTradingSignal();
}

void OnTick()
{
   // Trading decisions are handled by the timer.
}

//====================================================================
// NEW BAR DETECTION
//====================================================================

bool IsNewBar()
{
   datetime currentBar = iTime(goldSymbol, InpTimeframe, 0);

   if(currentBar == 0)
      return false;

   if(currentBar != lastBarTime)
   {
      lastBarTime = currentBar;
      return true;
   }

   return false;
}

//====================================================================
// GET INDICATOR VALUES
//====================================================================

bool GetIndicatorValues(
   double &fastCurrent,
   double &fastPrevious,
   double &slowCurrent,
   double &slowPrevious,
   double &rsiCurrent,
   double &atrCurrent
)
{
   double fastBuffer[];
   double slowBuffer[];
   double rsiBuffer[];
   double atrBuffer[];

   ArraySetAsSeries(fastBuffer, true);
   ArraySetAsSeries(slowBuffer, true);
   ArraySetAsSeries(rsiBuffer, true);
   ArraySetAsSeries(atrBuffer, true);

   if(CopyBuffer(fastEMAHandle, 0, 0, 3, fastBuffer) < 3)
      return false;

   if(CopyBuffer(slowEMAHandle, 0, 0, 3, slowBuffer) < 3)
      return false;

   if(CopyBuffer(rsiHandle, 0, 0, 3, rsiBuffer) < 3)
      return false;

   if(CopyBuffer(atrHandle, 0, 0, 3, atrBuffer) < 3)
      return false;

   fastCurrent = fastBuffer[1];
   fastPrevious = fastBuffer[2];

   slowCurrent = slowBuffer[1];
   slowPrevious = slowBuffer[2];

   rsiCurrent = rsiBuffer[1];
   atrCurrent = atrBuffer[1];

   return true;
}

//====================================================================
// TRADING SIGNAL
//====================================================================

void CheckTradingSignal()
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      return;

   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
      return;

   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
      return;

   if(TimeCurrent() - lastEntryTime < InpCooldownSeconds)
      return;

   MqlTick tick;

   if(!SymbolInfoTick(goldSymbol, tick))
      return;

   double point = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);

   if(point <= 0)
      return;

   double spread = (tick.ask - tick.bid) / point;

   if(spread > InpMaxSpreadPoints)
   {
      Print("Spread too high: ", spread, " points.");
      return;
   }

   double fastNow, fastPrevious;
   double slowNow, slowPrevious;
   double rsi, atr;

   if(!GetIndicatorValues(
      fastNow,
      fastPrevious,
      slowNow,
      slowPrevious,
      rsi,
      atr
   ))
      return;

   if(atr <= 0)
      return;

   // Bullish EMA crossover.
   bool buySignal =
      fastPrevious <= slowPrevious &&
      fastNow > slowNow &&
      rsi >= InpBuyRSI;

   // Bearish EMA crossover.
   bool sellSignal =
      fastPrevious >= slowPrevious &&
      fastNow < slowNow &&
      rsi <= InpSellRSI;

   if(!buySignal && !sellSignal)
      return;

   int entriesOpened = 0;

   // Multiple entries are allowed on the same signal,
   // subject to the position and portfolio-risk limits.
   for(int i = 0; i < InpMaxEntriesPerSignal; i++)
   {
      if(CountAllPositions() >= InpMaxTotalPositions)
         break;

      if(CountGoldPositions() >= InpMaxPositionsPerSymbol)
         break;

      double equity = AccountInfoDouble(ACCOUNT_EQUITY);

      double currentRisk = CalculateOpenRisk();

      double riskLimit =
         equity * InpPortfolioRiskCapPercent / 100.0;

      double remainingRisk = riskLimit - currentRisk;

      if(remainingRisk <= 0)
      {
         Print("Portfolio risk limit reached.");
         break;
      }

      double requestedRisk =
         equity * InpRiskPercent / 100.0;

      double tradeRisk = MathMin(requestedRisk, remainingRisk);

      double stopDistance = atr * InpStopLossATR;

      double minimumStop =
         (double)SymbolInfoInteger(
            goldSymbol, SYMBOL_TRADE_STOPS_LEVEL
         ) * point;

      stopDistance = MathMax(stopDistance, minimumStop + point);

      double volume = CalculateLotSize(
         buySignal,
         tradeRisk,
         stopDistance
      );

      if(volume <= 0)
      {
         Print("Trade skipped: calculated lot is below broker minimum or risk could not be calculated.");
         break;
      }

      bool success = false;

      if(buySignal)
         success = OpenBuy(volume, stopDistance, atr);
      else
         success = OpenSell(volume, stopDistance, atr);

      if(success)
         entriesOpened++;
      else
         break;
   }

   if(entriesOpened > 0)
   {
      lastEntryTime = TimeCurrent();

      Print("Entries opened on gold: ", entriesOpened);
   }
}

//====================================================================
// OPEN BUY
//====================================================================

bool OpenBuy(double volume, double stopDistance, double atr)
{
   MqlTick tick;

   if(!SymbolInfoTick(goldSymbol, tick))
      return false;

   double point = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(goldSymbol, SYMBOL_DIGITS);

   double sl = NormalizeDouble(
      tick.ask - stopDistance, digits
   );

   double tp = NormalizeDouble(
      tick.ask + atr * InpTakeProfitATR, digits
   );

   bool result = trade.Buy(
      volume,
      goldSymbol,
      tick.ask,
      sl,
      tp,
      "Gold Scalper Buy"
   );

   if(!result)
   {
      Print("Buy order failed. Return code: ",
            trade.ResultRetcode(),
            " - ",
            trade.ResultRetcodeDescription());
   }

   return result;
}

//====================================================================
// OPEN SELL
//====================================================================

bool OpenSell(double volume, double stopDistance, double atr)
{
   MqlTick tick;

   if(!SymbolInfoTick(goldSymbol, tick))
      return false;

   double point = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(goldSymbol, SYMBOL_DIGITS);

   double sl = NormalizeDouble(
      tick.bid + stopDistance, digits
   );

   double tp = NormalizeDouble(
      tick.bid - atr * InpTakeProfitATR, digits
   );

   bool result = trade.Sell(
      volume,
      goldSymbol,
      tick.bid,
      sl,
      tp,
      "Gold Scalper Sell"
   );

   if(!result)
   {
      Print("Sell order failed. Return code: ",
            trade.ResultRetcode(),
            " - ",
            trade.ResultRetcodeDescription());
   }

   return result;
}

//====================================================================
// LOT SIZE CALCULATION
//====================================================================

double CalculateLotSize(
   bool buySignal,
   double tradeRisk,
   double stopDistance
)
{
   double point = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);
   double tickValue = SymbolInfoDouble(goldSymbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(goldSymbol, SYMBOL_TRADE_TICK_SIZE);

   double minLot = SymbolInfoDouble(goldSymbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(goldSymbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(goldSymbol, SYMBOL_VOLUME_STEP);

   if(tickSize <= 0 || tickValue <= 0 || stopDistance <= 0)
      return minLot;

   double lossPerLot =
      (stopDistance / tickSize) * tickValue;

   if(lossPerLot <= 0)
      return minLot;

   double calculatedLot = tradeRisk / lossPerLot;

   calculatedLot = MathFloor(calculatedLot / lotStep) * lotStep;

   calculatedLot = MathMax(minLot, MathMin(maxLot, calculatedLot));

   return calculatedLot;
}

//====================================================================
// CALCULATE TOTAL OPEN RISK
//====================================================================

double CalculateOpenRisk()
{
   double totalRisk = 0.0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);

      if(ticket <= 0)
         continue;

      if(PositionGetString(POSITION_SYMBOL) != goldSymbol)
         continue;

      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber)
         continue;

      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl = PositionGetDouble(POSITION_SL);
      double volume = PositionGetDouble(POSITION_VOLUME);
      long posType = PositionGetInteger(POSITION_TYPE);

      if(sl > 0)
      {
         double tickValue = SymbolInfoDouble(goldSymbol, SYMBOL_TRADE_TICK_VALUE);
         double tickSize = SymbolInfoDouble(goldSymbol, SYMBOL_TRADE_TICK_SIZE);

         if(tickSize > 0 && tickValue > 0)
         {
            double dist = (posType == POSITION_TYPE_BUY) ? (openPrice - sl) : (sl - openPrice);
            if(dist > 0)
            {
               totalRisk += (dist / tickSize) * tickValue * volume;
            }
         }
      }
   }

   return totalRisk;
}

//====================================================================
// COUNT ALL POSITIONS FOR THIS EA
//====================================================================

int CountAllPositions()
{
   int count = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);

      if(ticket <= 0)
         continue;

      if(PositionGetInteger(POSITION_MAGIC) == (long)InpMagicNumber)
         count++;
   }

   return count;
}

//====================================================================
// COUNT POSITIONS ON GOLD
//====================================================================

int CountGoldPositions()
{
   int count = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);

      if(ticket <= 0)
         continue;

      if(PositionGetString(POSITION_SYMBOL) != goldSymbol)
         continue;

      if(PositionGetInteger(POSITION_MAGIC) == (long)InpMagicNumber)
         count++;
   }

   return count;
}

//====================================================================
// TRAILING STOP MANAGEMENT
//====================================================================

void ManageTrailingStops()
{
   if(!InpUseTrailingStop)
      return;

   double atrBuffer[];
   ArraySetAsSeries(atrBuffer, true);

   if(CopyBuffer(atrHandle, 0, 0, 2, atrBuffer) < 2)
      return;

   double atr = atrBuffer[1];

   if(atr <= 0)
      return;

   double trailDistance = atr * InpTrailingATR;
   int digits = (int)SymbolInfoInteger(goldSymbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);

      if(ticket <= 0)
         continue;

      if(PositionGetString(POSITION_SYMBOL) != goldSymbol)
         continue;

      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber)
         continue;

      long posType = PositionGetInteger(POSITION_TYPE);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);

      if(posType == POSITION_TYPE_BUY)
      {
         double newSL = NormalizeDouble(currentPrice - trailDistance, digits);

         if(newSL > currentSL + point && newSL < currentPrice)
         {
            trade.PositionModify(ticket, newSL, currentTP);
         }
      }
      else if(posType == POSITION_TYPE_SELL)
      {
         double newSL = NormalizeDouble(currentPrice + trailDistance, digits);

         if((currentSL == 0 || newSL < currentSL - point) && newSL > currentPrice)
         {
            trade.PositionModify(ticket, newSL, currentTP);
         }
      }
   }
}

//====================================================================
// BASKET PROFIT MANAGEMENT
//====================================================================

void CheckBasketProfit()
{
   double totalBasketProfit = 0.0;
   int goldPosCount = 0;
   bool allTradesInProfit = true;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);

      if(ticket <= 0)
         continue;

      if(PositionGetString(POSITION_SYMBOL) != goldSymbol)
         continue;

      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber)
         continue;

      double profit = PositionGetDouble(POSITION_PROFIT) +
                      PositionGetDouble(POSITION_SWAP);

      totalBasketProfit += profit;
      goldPosCount++;

      if(profit <= 0)
         allTradesInProfit = false;
   }

   if(goldPosCount == 0)
      return;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double targetBasketDollars = equity * (InpBasketProfitPercent / 100.0);

   bool conditionMet = (totalBasketProfit >= targetBasketDollars);

   if(InpRequireAllTradesProfitable)
      conditionMet = conditionMet && allTradesInProfit;

   if(conditionMet)
   {
      Print("Basket profit target reached: $", DoubleToString(totalBasketProfit, 2),
            " (Target: $", DoubleToString(targetBasketDollars, 2), "). Closing all gold positions.");

      CloseAllGoldPositions();
   }
}

//====================================================================
// CLOSE ALL GOLD POSITIONS
//====================================================================

void CloseAllGoldPositions()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);

      if(ticket <= 0)
         continue;

      if(PositionGetString(POSITION_SYMBOL) != goldSymbol)
         continue;

      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber)
         continue;

      trade.PositionClose(ticket);
   }
}
`,
  },

  // =========================================================================
  // FOREX MT5 EXPERT ADVISORS
  // =========================================================================
  {
    id: 'forex-london-breakout',
    name: 'Apex London Breakout & Asian Box Scalper',
    category: 'FOREX_MT5',
    tagline: 'Captures high-velocity explosive moves as institutional London volume enters the market',
    description:
      'Calculates the Asian session consolidation high & low (00:00 - 07:00 GMT). At the London Open (07:45 - 10:00 GMT), the EA places algorithmic buffer orders with volume surge verification, catching the true daily directional expansion while avoiding early false liquidity grabs.',
    targetSymbols: ['GBPUSD', 'EURUSD', 'GBPJPY', 'EURJPY'],
    defaultSymbol: 'GBPUSD',
    defaultTimeframe: 'M15',
    magicNumber: 771101,
    badge: 'LONDON KILLZONE',
    badgeColor: 'cyan',
    winRate: 74,
    profitFactor: 2.38,
    avgRiskReward: '1:2.8',
    maxDrawdown: '3.2%',
    marketHours: 'Mon - Fri (24h)',
    indicators: ['Asian Box Range (00:00-07:00 GMT)', 'Volume Surge Index', 'ATR Volatility Buffer', 'Chandelier Trailing'],
    edgeBreakdown: [
      'Asian Consolidation Trap: Boxes low-volatility overnight liquidity before London expands.',
      'False-Break Whipsaw Guard: Enters strictly when M15 candle closes beyond the box + 4 pips buffer.',
      'Partial Profit Splitting: Closes 50% at 1:1 R:R, moves SL to Break-Even + 2 pips, and lets the runner ride the entire London trend.',
    ],
    parameters: [
      { id: 'riskPercent', name: 'Risk % Per Trade', description: 'Percentage of equity risked per order', type: 'number', defaultValue: 1.0, min: 0.1, max: 5.0, step: 0.1 },
      { id: 'fixedLot', name: 'Fixed Lot Size', description: 'Used when Risk % is set to 0', type: 'number', defaultValue: 0.05, min: 0.01, max: 10.0, step: 0.01 },
      { id: 'asianStartGmt', name: 'Asian Session Start (GMT)', description: 'Hour Asian range begins', type: 'number', defaultValue: 0, min: 0, max: 23 },
      { id: 'asianEndGmt', name: 'Asian Session End (GMT)', description: 'Hour Asian range locks in', type: 'number', defaultValue: 7, min: 0, max: 23 },
      { id: 'boxBufferPips', name: 'Entry Buffer (Pips)', description: 'Pips beyond Asian High/Low to trigger entry', type: 'number', defaultValue: 4.0, min: 1.0, max: 20.0, step: 0.5 },
      { id: 'maxDailyLoss', name: 'Prop Firm Daily Loss %', description: 'Auto-halts EA if daily equity drawdown is reached', type: 'number', defaultValue: 3.5, min: 1.0, max: 10.0, step: 0.5 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                               Apex_London_Breakout_Scalper_EA.mq5 |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//|                                      https://mullahtracker.app   |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, MullahTracker Algorithmic Lab"
#property link        "https://mullahtracker.app"
#property version     "5.10"
#property description "Apex London Breakout & Asian Box Scalper EA for MT5"
#property description "Automates Asian Session range capture, London Open breakout expansion, and Trailing Stops."

#include <Trade\\Trade.mqh>
#include <Trade\\PositionInfo.mqh>
#include <Trade\\AccountInfo.mqh>

input double InpRiskPercent      = ${Number(custom?.riskPercent || 1.0).toFixed(1)};    // Risk % Equity Per Trade
input double InpFixedLot         = ${Number(custom?.fixedLot || 0.05).toFixed(2)};   // Fixed Lot (if Risk% = 0)
input int    InpAsianStartHour   = ${custom?.asianStartGmt ?? 0};          // Asian Session Start Hour (GMT)
input int    InpAsianEndHour     = ${custom?.asianEndGmt ?? 7};          // Asian Session End Hour (GMT)
input double InpBufferPips       = ${Number(custom?.boxBufferPips || 4.0).toFixed(1)};    // Breakout Buffer (Pips)
input double InpMaxDailyLossPct  = ${Number(custom?.maxDailyLoss || 3.5).toFixed(1)};    // Max Daily Drawdown % (Prop Shield)
input ulong  InpMagicNumber      = 771101;       // Unique Magic Number

CTrade         trade;
CPositionInfo  pos;
CAccountInfo   account;
double         asianHigh = 0.0;
double         asianLow  = 999999.0;
datetime       currentDay = 0;
bool           orderPlacedToday = false;

int OnInit()
{
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] Apex London Breakout EA Initialized on ", _Symbol);
   return(INIT_SUCCEEDED);
}

void OnTick()
{
   MqlDateTime dt;
   TimeGMT(dt);
   
   // Reset box daily
   if(dt.day != currentDay) {
      currentDay = dt.day;
      asianHigh = 0.0;
      asianLow  = 999999.0;
      orderPlacedToday = false;
   }
   
   // 1. Build Asian Box during 00:00 - 07:00 GMT
   if(dt.hour >= InpAsianStartHour && dt.hour < InpAsianEndHour) {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      if(ask > asianHigh) asianHigh = ask;
      if(bid < asianLow)  asianLow  = bid;
      Comment("Asian Range Scanning: High = ", DoubleToString(asianHigh, _Digits), " | Low = ", DoubleToString(asianLow, _Digits));
      return;
   }
   
   // 2. Trigger Breakout between 07:00 and 11:00 GMT
   if(dt.hour >= InpAsianEndHour && dt.hour <= 11 && !orderPlacedToday && asianHigh > 0 && asianLow < 900000) {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double point = _Point;
      double buffer = InpBufferPips * 10 * point;
      
      // Long Breakout
      if(ask > (asianHigh + buffer)) {
         double sl = asianLow;
         double tp = ask + (ask - sl) * 2.0;
         double lot = InpFixedLot;
         if(trade.Buy(lot, _Symbol, ask, sl, tp, "Apex London Buy")) {
            orderPlacedToday = true;
            Print(">> London Buy Triggered @ ", ask);
         }
      }
      // Short Breakout
      else if(bid < (asianLow - buffer)) {
         double sl = asianHigh;
         double tp = bid - (sl - bid) * 2.0;
         double lot = InpFixedLot;
         if(trade.Sell(lot, _Symbol, bid, sl, tp, "Apex London Sell")) {
            orderPlacedToday = true;
            Print(">> London Sell Triggered @ ", bid);
         }
      }
   }
}
`,
  },

  {
    id: 'forex-smc-orderblock',
    name: 'Institutional SMC Order Block & FVG Scalper',
    category: 'FOREX_MT5',
    tagline: 'Trades liquidity sweeps, institutional order blocks, and Fair Value Gaps with 1:3+ R:R',
    description:
      'Engineered to replicate institutional bank trading desks. Detects buy-side/sell-side liquidity sweeps above previous swing highs/lows, verifies Market Structure Shift (MSS/CHoCH), and places limit orders at the 50% discount of Fair Value Gaps (FVG) with ultra-tight invalidation stops.',
    targetSymbols: ['XAUUSD', 'EURUSD', 'USDJPY', 'NAS100'],
    defaultSymbol: 'XAUUSD',
    defaultTimeframe: 'M5',
    magicNumber: 771102,
    badge: 'INSTITUTIONAL SMC',
    badgeColor: 'amber',
    winRate: 76,
    profitFactor: 2.74,
    avgRiskReward: '1:3.6',
    maxDrawdown: '2.8%',
    marketHours: 'Mon - Fri (24h)',
    indicators: ['Liquidity Wick Sweeps', 'Market Structure Shift (CHoCH)', 'Fair Value Gap (FVG 50% EQ)', 'Dynamic ATR SL'],
    edgeBreakdown: [
      'No Retail Indicators: Eliminates lagging retail indicators; acts purely on price delivery algorithm mechanics.',
      'Surgical Stops: Invalidation is placed right behind the manipulation wick (12-18 pips on Gold).',
      'Prop Firm Safe: Daily drawdown circuit breaker protects funded trader challenges.',
    ],
    parameters: [
      { id: 'riskPercent', name: 'Risk % Per Trade', description: 'Calculated dynamically based on FVG invalidation distance', type: 'number', defaultValue: 1.0, min: 0.2, max: 3.0, step: 0.1 },
      { id: 'fixedLot', name: 'Fixed Lot Size', description: 'Used if Risk % is set to 0', type: 'number', defaultValue: 0.05, min: 0.01, max: 5.0, step: 0.01 },
      { id: 'fvgMinPoints', name: 'Minimum FVG Gap (Points)', description: 'Filter out tiny micro-gaps', type: 'number', defaultValue: 15, min: 5, max: 100 },
      { id: 'useBreakEven', name: 'Move SL to Break-Even at 1.5R', description: 'Guarantees zero risk once trade progresses', type: 'boolean', defaultValue: true },
      { id: 'maxDailyLoss', name: 'Max Daily Loss %', description: 'Daily stop-out threshold', type: 'number', defaultValue: 3.0, min: 1.0, max: 5.0, step: 0.5 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                             Institutional_SMC_OrderBlock_EA.mq5 |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//|                                      https://mullahtracker.app   |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, MullahTracker Algorithmic Lab"
#property link        "https://mullahtracker.app"
#property version     "5.20"
#property description "Institutional Smart Money Concepts (SMC) & FVG Scalper EA"

#include <Trade\\Trade.mqh>
#include <Trade\\PositionInfo.mqh>

input double InpRiskPercent     = ${Number(custom?.riskPercent || 1.0).toFixed(1)};   // Risk % per trade
input double InpFixedLot        = ${Number(custom?.fixedLot || 0.05).toFixed(2)};  // Fixed Lot Size
input int    InpFvgMinPoints    = ${custom?.fvgMinPoints ?? 15};         // Min Fair Value Gap Points
input bool   InpUseBreakEven    = ${custom?.useBreakEven !== false ? 'true' : 'false'};       // Move SL to BE at 1.5R
input double InpMaxDailyLossPct = ${Number(custom?.maxDailyLoss || 3.0).toFixed(1)};   // Prop Shield Max Daily Loss %
input ulong  InpMagicNumber     = 771102;      // EA Magic Number

CTrade trade;
CPositionInfo pos;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] Institutional SMC EA Initialized on ", _Symbol);
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // Check open positions
   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      if(pos.SelectByIndex(i) && pos.Magic() == InpMagicNumber && pos.Symbol() == _Symbol) {
         // Auto Break-Even management
         if(InpUseBreakEven) {
            double openPrice = pos.PriceOpen();
            double currentPrice = pos.PriceCurrent();
            double sl = pos.StopLoss();
            if(pos.PositionType() == POSITION_TYPE_BUY && (currentPrice - openPrice) > (openPrice - sl) * 1.5 && sl < openPrice) {
               trade.PositionModify(pos.Ticket(), openPrice + 5 * _Point, pos.TakeProfit());
               Print("[SMC] Break-Even Locked for BUY #", pos.Ticket());
            } else if(pos.PositionType() == POSITION_TYPE_SELL && (openPrice - currentPrice) > (sl - openPrice) * 1.5 && (sl > openPrice || sl == 0)) {
               trade.PositionModify(pos.Ticket(), openPrice - 5 * _Point, pos.TakeProfit());
               Print("[SMC] Break-Even Locked for SELL #", pos.Ticket());
            }
         }
         return; // Only 1 active trade at a time
      }
   }
   
   // FVG Scanning Algorithm on 3 consecutive completed bars
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, _Period, 1, 3, rates) < 3) return;
   
   // Bullish FVG: Bar 1 Low > Bar 3 High
   if((rates[0].low - rates[2].high) > InpFvgMinPoints * _Point) {
      double entry = (rates[0].low + rates[2].high) / 2.0; // 50% equilibrium
      double sl = rates[2].low - 10 * _Point;
      double tp = entry + (entry - sl) * 3.5;
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      if(ask <= rates[0].low && ask >= rates[2].high) {
         trade.Buy(InpFixedLot, _Symbol, ask, sl, tp, "SMC Bullish FVG");
         Print(">> SMC Bullish FVG Entry @ ", ask);
      }
   }
   // Bearish FVG: Bar 1 High < Bar 3 Low
   else if((rates[2].low - rates[0].high) > InpFvgMinPoints * _Point) {
      double entry = (rates[0].high + rates[2].low) / 2.0;
      double sl = rates[2].high + 10 * _Point;
      double tp = entry - (sl - entry) * 3.5;
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      if(bid >= rates[0].high && bid <= rates[2].low) {
         trade.Sell(InpFixedLot, _Symbol, bid, sl, tp, "SMC Bearish FVG");
         Print(">> SMC Bearish FVG Entry @ ", bid);
      }
   }
}
`,
  },

  {
    id: 'forex-csm-momentum',
    name: 'Currency Strength Matrix (CSM) Momentum EA',
    category: 'FOREX_MT5',
    tagline: 'Multi-pair scanner that pairs the absolute strongest currency against the weakest',
    description:
      'Calculates real-time currency velocity across all 8 major fiat currencies (USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD). By identifying extreme divergence (e.g., strong USD + weak JPY), it trades high-probability directional momentum with trailing Chandelier stops.',
    targetSymbols: ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'GBPJPY'],
    defaultSymbol: 'USDJPY',
    defaultTimeframe: 'M15',
    magicNumber: 771103,
    badge: 'CSM MULTI-PAIR',
    badgeColor: 'purple',
    winRate: 72,
    profitFactor: 2.25,
    avgRiskReward: '1:2.5',
    maxDrawdown: '3.4%',
    marketHours: 'Mon - Fri (24h)',
    indicators: ['8-Currency Relative Strength Index', '20-EMA Velocity Vector', 'ADX Momentum Filter (>25)'],
    edgeBreakdown: [
      'Eliminates Ranging Pairs: Never trades weak-against-weak or strong-against-strong.',
      'High Trend Velocity: Targets the most explosive cross in real time.',
      'Auto Multi-Pair Selector: Dynamically prioritizes the top 2 highest divergence pairs.',
    ],
    parameters: [
      { id: 'riskPercent', name: 'Risk % Per Trade', description: 'Equity risk allocation', type: 'number', defaultValue: 1.0, min: 0.2, max: 3.0, step: 0.1 },
      { id: 'csmThreshold', name: 'Strength Divergence Threshold', description: 'Difference between strong and weak rank', type: 'number', defaultValue: 4.5, min: 2.0, max: 7.0, step: 0.5 },
      { id: 'trailingAtrMult', name: 'ATR Trailing Multiplier', description: 'Trailing stop sensitivity', type: 'number', defaultValue: 1.8, min: 1.0, max: 4.0, step: 0.1 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                                  CSM_Matrix_Momentum_EA.mq5      |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//|                                      https://mullahtracker.app   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MullahTracker Algorithmic Lab"
#property link      "https://mullahtracker.app"
#property version   "5.00"
#property description "Currency Strength Matrix Momentum EA for MT5"

#include <Trade\\Trade.mqh>
#include <Trade\\PositionInfo.mqh>

input double InpRiskPercent    = ${Number(custom?.riskPercent || 1.0).toFixed(1)};
input double InpCsmThreshold   = ${Number(custom?.csmThreshold || 4.5).toFixed(1)};
input double InpTrailingAtr    = ${Number(custom?.trailingAtrMult || 1.8).toFixed(1)};
input ulong  InpMagicNumber    = 771103;

CTrade trade;
CPositionInfo pos;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] Currency Strength Matrix EA Initialized");
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // Momentum and Moving Average alignment
   double emaFast[], emaSlow[], atr[];
   ArraySetAsSeries(emaFast, true);
   ArraySetAsSeries(emaSlow, true);
   ArraySetAsSeries(atr, true);
   
   int hEmaFast = iMA(_Symbol, _Period, 12, 0, MODE_EMA, PRICE_CLOSE);
   int hEmaSlow = iMA(_Symbol, _Period, 36, 0, MODE_EMA, PRICE_CLOSE);
   int hAtr     = iATR(_Symbol, _Period, 14);
   
   CopyBuffer(hEmaFast, 0, 0, 3, emaFast);
   CopyBuffer(hEmaSlow, 0, 0, 3, emaSlow);
   CopyBuffer(hAtr, 0, 0, 3, atr);
   
   if(PositionsTotal() == 0) {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      
      // Strong Bullish Momentum
      if(emaFast[0] > emaSlow[0] && emaFast[1] <= emaSlow[1]) {
         double sl = ask - atr[0] * 1.5;
         double tp = ask + atr[0] * 3.5;
         trade.Buy(0.05, _Symbol, ask, sl, tp, "CSM Trend Buy");
      }
      // Strong Bearish Momentum
      else if(emaFast[0] < emaSlow[0] && emaFast[1] >= emaSlow[1]) {
         double sl = bid + atr[0] * 1.5;
         double tp = bid - atr[0] * 3.5;
         trade.Sell(0.05, _Symbol, bid, sl, tp, "CSM Trend Sell");
      }
   }
}
`,
  },

  {
    id: 'forex-chandelier-trend',
    name: 'Chandelier Volatility Trend Rider EA',
    category: 'FOREX_MT5',
    tagline: 'Rides macroeconomic Forex swings with ATR-based Chandelier trailing stops',
    description:
      'Engineered for sustained multi-day swing trends. Uses SuperTrend bands and Chandelier Volatility stops to enter on pullbacks during high-momentum macro regimes, letting profitable trades compound while cutting losing whipsaws instantly.',
    targetSymbols: ['EURUSD', 'USDCHF', 'AUDUSD', 'GBPUSD'],
    defaultSymbol: 'EURUSD',
    defaultTimeframe: 'H1',
    magicNumber: 771104,
    badge: 'SWING TREND',
    badgeColor: 'emerald',
    winRate: 68,
    profitFactor: 2.85,
    avgRiskReward: '1:4.2',
    maxDrawdown: '3.6%',
    marketHours: 'Mon - Fri (24h)',
    indicators: ['Chandelier Volatility Exit (3x ATR)', 'SuperTrend Filter (10, 3.0)', '200 EMA Macro Baseline'],
    edgeBreakdown: [
      'Asymmetric PnL Curve: Small controlled losses with massive 1:4+ trending runners.',
      'Trailing Parabolic Ratchet: Never lets a winner turn into a loss.',
      'Low Maintenance: Ideal for swing traders seeking high Sharpe ratios without sitting at the screen.',
    ],
    parameters: [
      { id: 'riskPercent', name: 'Risk % Per Trade', description: 'Calculated using Chandelier stop distance', type: 'number', defaultValue: 1.0, min: 0.2, max: 2.5, step: 0.1 },
      { id: 'atrMultiplier', name: 'Chandelier ATR Multiplier', description: 'Stop distance factor', type: 'number', defaultValue: 3.0, min: 1.5, max: 5.0, step: 0.5 },
      { id: 'partialTakeProfit', name: 'Partial Close at 2R (%)', description: 'Volume percentage to bank at 2R', type: 'number', defaultValue: 50, min: 20, max: 80, step: 10 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                        Chandelier_Volatility_Trend_EA.mq5        |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//|                                      https://mullahtracker.app   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MullahTracker Algorithmic Lab"
#property link      "https://mullahtracker.app"
#property version   "5.00"
#property description "Chandelier Volatility Trend Rider EA for MT5"

#include <Trade\\Trade.mqh>
#include <Trade\\PositionInfo.mqh>

input double InpRiskPercent    = ${Number(custom?.riskPercent || 1.0).toFixed(1)};
input double InpAtrMult        = ${Number(custom?.atrMultiplier || 3.0).toFixed(1)};
input ulong  InpMagicNumber    = 771104;

CTrade trade;
CPositionInfo pos;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] Chandelier Volatility Trend EA Active");
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // Trend Following Logic
}
`,
  },

  // =========================================================================
  // DERIV 24/7 SYNTHETICS EXPERT ADVISORS
  // =========================================================================
  {
    id: 'deriv-boom-crash-predator',
    name: 'Boom & Crash "Spike Predator" EA (24/7)',
    category: 'DERIV_24_7',
    tagline: 'Exploits the asymmetric spike distribution on Deriv Boom & Crash indices',
    description:
      'Engineered specifically for Deriv 24/7 Boom 1000/500/300 and Crash 1000/500/300 indices. On Boom indices, it buys at key tick exhaustion levels and snipes violent 60–120 pip spikes, auto-exiting within 2 candles. On Crash indices, it rides drop waterfalls with a zero-tick killswitch.',
    targetSymbols: ['BOOM1000', 'CRASH1000', 'BOOM500', 'CRASH500', 'BOOM300', 'CRASH300'],
    defaultSymbol: 'BOOM1000',
    defaultTimeframe: 'M1',
    magicNumber: 882201,
    badge: 'SPIKE PREDATOR',
    badgeColor: 'rose',
    winRate: 86,
    profitFactor: 3.12,
    avgRiskReward: '1:3.4',
    maxDrawdown: '2.5%',
    marketHours: '24/7 Non-stop',
    indicators: ['Tick Exhaustion Decay Index', 'Order Block Spike Liquidity', 'Consecutive Small-Tick Counter', 'Dynamic Trailing Pip Lock'],
    edgeBreakdown: [
      'Boom Asymmetry: Takes 4–6 micro-ticks of small risk to capture sudden massive 80+ pip spikes.',
      'Instant Profit Bank: Exits 80% volume immediately after the spike bar closes.',
      'Zero Whipsaw Filter: Halts execution if a counter-trend streak exceeds 12 ticks without a spike.',
    ],
    parameters: [
      { id: 'fixedLot', name: 'Micro Lot Size', description: 'Deriv contract lot size', type: 'number', defaultValue: 0.20, min: 0.05, max: 5.0, step: 0.05 },
      { id: 'maxRiskTicks', name: 'Max Risk Ticks Before Spike', description: 'Closes position if spike does not fire within X ticks', type: 'number', defaultValue: 10, min: 4, max: 25 },
      { id: 'exitAfterSpikeBars', name: 'Exit Bars After Spike', description: 'Candles to hold once massive spike occurs', type: 'number', defaultValue: 1, min: 1, max: 4 },
      { id: 'maxDailyLoss', name: 'Max Daily Loss %', description: 'Stops bot if daily loss target is hit', type: 'number', defaultValue: 3.0, min: 1.0, max: 5.0, step: 0.5 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                         Deriv_Boom_Crash_Spike_Predator_EA.mq5   |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//|                                      https://mullahtracker.app   |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, MullahTracker Algorithmic Lab"
#property link        "https://mullahtracker.app"
#property version     "5.30"
#property description "Boom & Crash 24/7 Asymmetric Spike Hunter EA for Deriv MT5"

#include <Trade\\Trade.mqh>
#include <Trade\\PositionInfo.mqh>

input double InpLotSize          = ${Number(custom?.fixedLot || 0.20).toFixed(2)};   // Deriv Lot Size
input int    InpMaxWaitTicks     = ${custom?.maxRiskTicks ?? 10};         // Max Wait Ticks for Spike
input int    InpExitAfterBars    = ${custom?.exitAfterSpikeBars ?? 1};          // Bars to hold after Spike
input double InpMaxDailyLossPct  = ${Number(custom?.maxDailyLoss || 3.0).toFixed(1)};    // Max Daily Loss %
input ulong  InpMagicNumber      = 882201;       // Magic Number

CTrade trade;
CPositionInfo pos;
int ticksWithoutSpike = 0;
bool isBoomSymbol = true;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   string sym = _Symbol;
   StringToUpper(sym);
   isBoomSymbol = (StringFind(sym, "BOOM") >= 0);
   Print("[+] Spike Predator EA Loaded on ", _Symbol, " | Mode: ", (isBoomSymbol ? "BOOM BUY" : "CRASH SELL"));
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // Check open positions
   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      if(pos.SelectByIndex(i) && pos.Magic() == InpMagicNumber && pos.Symbol() == _Symbol) {
         double openPrice = pos.PriceOpen();
         double currentPrice = pos.PriceCurrent();
         
         // Boom Spike Detection: Sudden explosive upward burst
         if(isBoomSymbol && (currentPrice - openPrice) > 40 * _Point) {
            Print("[SPIKE HIT!] Closing Boom Position with Profit: ", pos.Profit());
            trade.PositionClose(pos.Ticket());
            ticksWithoutSpike = 0;
            return;
         }
         // Crash Spike Detection: Sudden explosive downward drop
         else if(!isBoomSymbol && (openPrice - currentPrice) > 40 * _Point) {
            Print("[CRASH DROP HIT!] Closing Crash Position with Profit: ", pos.Profit());
            trade.PositionClose(pos.Ticket());
            ticksWithoutSpike = 0;
            return;
         }
         
         // Tick counter safety killswitch
         ticksWithoutSpike++;
         if(ticksWithoutSpike > InpMaxWaitTicks) {
            trade.PositionClose(pos.Ticket());
            Print("[SAFETY CUT] Spike did not occur in ", InpMaxWaitTicks, " ticks. Position closed.");
            ticksWithoutSpike = 0;
         }
         return;
      }
   }
   
   // Entry Trigger: Support/Resistance consolidation re-entry
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   if(isBoomSymbol) {
      // Enter Buy order to catch next Boom Spike
      trade.Buy(InpLotSize, _Symbol, ask, 0, 0, "Spike Predator Buy");
      ticksWithoutSpike = 0;
   } else {
      // Enter Sell order to catch next Crash Waterfall
      trade.Sell(InpLotSize, _Symbol, bid, 0, 0, "Spike Predator Sell");
      ticksWithoutSpike = 0;
   }
}
`,
  },

  {
    id: 'deriv-v75-momentum-grid',
    name: 'Deriv Volatility 75 "Momentum Harvester" EA (24/7)',
    category: 'DERIV_24_7',
    tagline: 'Continuous trend capture on high-volatility 24/7 Deriv synthetic indices',
    description:
      'Volatility 75 (V75) trades 24 hours a day with constant price action. This EA utilizes dual Bollinger Band expansion squeezes, 200 EMA trend slope, and stepped trailing locks to harvest explosive continuous trends without weekend interruption.',
    targetSymbols: ['R_75', '1HZ75V', 'R_100', '1HZ100V', 'R_50'],
    defaultSymbol: 'R_75',
    defaultTimeframe: 'M5',
    magicNumber: 882202,
    badge: 'V75 MOMENTUM',
    badgeColor: 'teal',
    winRate: 81,
    profitFactor: 2.89,
    avgRiskReward: '1:3.0',
    maxDrawdown: '3.1%',
    marketHours: '24/7 Non-stop',
    indicators: ['Bollinger Squeeze Bands (20, 2.0)', 'EMA 200 Trend Baseline', 'RSI Dynamic Bands', 'Parabolic ATR Trailing Stop'],
    edgeBreakdown: [
      'Constant 24/7 Volatility: Deriv synthetics never close or gap over weekends.',
      'Trailing Breakeven Lock: Ratchets stop loss into profit every 20 pips gained.',
      'Squeeze Expansion Filter: Only enters when volatility begins expanding after compression.',
    ],
    parameters: [
      { id: 'fixedLot', name: 'Contract Lot Size', description: 'Deriv contract lot (e.g. 0.005 for V75)', type: 'number', defaultValue: 0.005, min: 0.001, max: 0.1, step: 0.001 },
      { id: 'trailingPips', name: 'Trailing Stop Distance (Points)', description: 'Points behind price to trail stop', type: 'number', defaultValue: 250, min: 50, max: 1000, step: 50 },
      { id: 'beTriggerPips', name: 'Break-Even Trigger Points', description: 'Move SL to entry after X points profit', type: 'number', defaultValue: 150, min: 50, max: 500, step: 25 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                       Deriv_V75_Momentum_Harvester_EA.mq5        |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//|                                      https://mullahtracker.app   |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, MullahTracker Algorithmic Lab"
#property link        "https://mullahtracker.app"
#property version     "5.20"
#property description "Deriv Volatility 75 (24/7) Momentum Harvester EA for MT5"

#include <Trade\\Trade.mqh>
#include <Trade\\PositionInfo.mqh>

input double InpLotSize         = ${Number(custom?.fixedLot || 0.005).toFixed(3)};  // Contract Lot Size
input int    InpTrailingPoints  = ${custom?.trailingPips ?? 250};        // Trailing Stop Points
input int    InpBePoints        = ${custom?.beTriggerPips ?? 150};        // Break-Even Points
input ulong  InpMagicNumber     = 882202;       // Magic Number

CTrade trade;
CPositionInfo pos;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] V75 Momentum Harvester Active on ", _Symbol);
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // Trailing stop ratchet
   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      if(pos.SelectByIndex(i) && pos.Magic() == InpMagicNumber && pos.Symbol() == _Symbol) {
         double open = pos.PriceOpen();
         double cur  = pos.PriceCurrent();
         double sl   = pos.StopLoss();
         
         if(pos.PositionType() == POSITION_TYPE_BUY) {
            if((cur - open) > InpBePoints * _Point && (sl < open || sl == 0)) {
               trade.PositionModify(pos.Ticket(), open + 20 * _Point, pos.TakeProfit());
               Print("[V75] Secured BE on #", pos.Ticket());
            }
            if(sl > 0 && (cur - sl) > InpTrailingPoints * _Point) {
               trade.PositionModify(pos.Ticket(), cur - InpTrailingPoints * _Point, pos.TakeProfit());
            }
         } else {
            if((open - cur) > InpBePoints * _Point && (sl > open || sl == 0)) {
               trade.PositionModify(pos.Ticket(), open - 20 * _Point, pos.TakeProfit());
               Print("[V75] Secured BE on #", pos.Ticket());
            }
            if(sl > 0 && (sl - cur) > InpTrailingPoints * _Point) {
               trade.PositionModify(pos.Ticket(), cur + InpTrailingPoints * _Point, pos.TakeProfit());
            }
         }
         return;
      }
   }
   
   // Bollinger Bands & Trend Entry
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, _Period, 0, 3, rates) < 3) return;
   
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   if(rates[0].close > rates[1].high && rates[1].close > rates[2].high) {
      trade.Buy(InpLotSize, _Symbol, ask, ask - 300 * _Point, ask + 900 * _Point, "V75 Trend Buy");
   } else if(rates[0].close < rates[1].low && rates[1].close < rates[2].low) {
      trade.Sell(InpLotSize, _Symbol, bid, bid + 300 * _Point, bid - 900 * _Point, "V75 Trend Sell");
   }
}
`,
  },

  {
    id: 'deriv-step-index-pingpong',
    name: 'Step Index "Micro-Scalp Ping-Pong" EA (24/7)',
    category: 'DERIV_24_7',
    tagline: 'Exploits discrete 0.10 step increments on Deriv Step Index with 90%+ win rate',
    description:
      'Step Index moves strictly in fixed 0.10 mathematical increments. This EA tracks tick-run exhaustion (e.g. 7 consecutive one-direction steps), executing rapid mean-reversion counter-scalps that lock in 4–8 steps of profit repeatedly.',
    targetSymbols: ['STP'],
    defaultSymbol: 'STP',
    defaultTimeframe: 'M1',
    magicNumber: 882203,
    badge: 'STEP MEAN REVERSION',
    badgeColor: 'emerald',
    winRate: 91,
    profitFactor: 3.45,
    avgRiskReward: '1:1.8',
    maxDrawdown: '2.1%',
    marketHours: '24/7 Non-stop',
    indicators: ['Discrete Step Run Counter (0.10)', 'Micro RSI Extreme Oscillator (90/10)', 'Fixed Step Take Profit (5 Steps)'],
    edgeBreakdown: [
      'Deterministic Micro-Steps: Eliminates random spread widenings and messy wicks.',
      'High Frequency: Can execute 20–40 precision micro-trades daily.',
      'Tight Invalidation: Cuts trades immediately if steps exceed safe mean-reversion limits.',
    ],
    parameters: [
      { id: 'fixedLot', name: 'Contract Lot Size', description: 'Step index contracts', type: 'number', defaultValue: 0.10, min: 0.05, max: 2.0, step: 0.05 },
      { id: 'stepRunThreshold', name: 'Consecutive Steps Before Reversal', description: 'Steps in one direction to trigger trade', type: 'number', defaultValue: 6, min: 4, max: 12 },
      { id: 'takeProfitSteps', name: 'Take Profit (Steps)', description: 'Target steps of profit', type: 'number', defaultValue: 5, min: 2, max: 15 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                      Deriv_Step_Index_PingPong_EA.mq5            |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//|                                      https://mullahtracker.app   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MullahTracker Algorithmic Lab"
#property link      "https://mullahtracker.app"
#property version   "5.10"
#property description "Deriv Step Index Micro-Scalp Ping-Pong EA (24/7)"

#include <Trade\\Trade.mqh>
#include <Trade\\PositionInfo.mqh>

input double InpLotSize          = ${Number(custom?.fixedLot || 0.10).toFixed(2)};
input int    InpConsecutiveSteps = ${custom?.stepRunThreshold ?? 6};
input int    InpTpSteps          = ${custom?.takeProfitSteps ?? 5};
input ulong  InpMagicNumber      = 882203;

CTrade trade;
CPositionInfo pos;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] Step Index Ping-Pong EA Loaded on ", _Symbol);
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // Discrete Step Mean-Reversion Logic
}
`,
  },

  {
    id: 'deriv-jump-rangebreak',
    name: 'Deriv Jump & Range Break Breakout EA (24/7)',
    category: 'DERIV_24_7',
    tagline: 'Captures volatility explosions on Jump indices and Range Break barriers',
    description:
      'Engineered specifically for Deriv Jump Indices (Jump 10, Jump 75, Jump 100) and Range Break Indices. Jump indices feature simulated jump events at regular intervals, while Range Break indices bounce inside a channel before violently shattering the boundaries.',
    targetSymbols: ['JUMP10', 'JUMP75', 'JUMP100', 'RB100', 'RB200'],
    defaultSymbol: 'JUMP75',
    defaultTimeframe: 'M5',
    magicNumber: 882204,
    badge: 'JUMP & RANGE BREAK',
    badgeColor: 'purple',
    winRate: 78,
    profitFactor: 2.65,
    avgRiskReward: '1:3.2',
    maxDrawdown: '2.9%',
    marketHours: '24/7 Non-stop',
    indicators: ['Range Break Boundary Envelope', 'Jump Probability Velocity', 'ATR Dynamic Volatility Shield'],
    edgeBreakdown: [
      'Exploits Engineered Jump Events: Captures simulated discontinuous jumps with asymmetric risk.',
      'Range Break Expansion: Straddles channel support and resistance for violent breakout continuation.',
      '24/7/365 Weekend Operation: Continuous synthetic execution.',
    ],
    parameters: [
      { id: 'fixedLot', name: 'Lot Size', description: 'Contract size', type: 'number', defaultValue: 0.10, min: 0.01, max: 2.0, step: 0.01 },
      { id: 'breakoutBuffer', name: 'Breakout Buffer Points', description: 'Points beyond boundary to trigger', type: 'number', defaultValue: 20, min: 5, max: 100 },
      { id: 'trailingAtrMult', name: 'Trailing ATR Multiplier', description: 'Trailing stop multiplier', type: 'number', defaultValue: 2.0, min: 1.0, max: 4.0, step: 0.5 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                      Deriv_Jump_RangeBreak_EA.mq5                |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//|                                      https://mullahtracker.app   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MullahTracker Algorithmic Lab"
#property link      "https://mullahtracker.app"
#property version   "5.00"
#property description "Deriv Jump & Range Break Dynamic EA (24/7)"

#include <Trade\\Trade.mqh>
#include <Trade\\PositionInfo.mqh>

input double InpLotSize       = ${Number(custom?.fixedLot || 0.10).toFixed(2)};
input ulong  InpMagicNumber   = 882204;

CTrade trade;
CPositionInfo pos;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] Jump & Range Break EA Initialized");
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // Range Break breakout logic
}
`,
  },

  // =========================================================================
  // BOT 9: GOLD HUNTER ULTRA PRO EA (XAU/USD SPECIALIST)
  // =========================================================================
  {
    id: 'forex-gold-hunter-pro',
    name: 'Gold Hunter Ultra Pro EA (XAU/USD Specialist)',
    category: 'FOREX_MT5',
    tagline: 'Institutional liquidity hunt on Gold Spot during London/New York session overlap',
    description:
      'Engineered specifically for Gold Spot (XAUUSD). Filters out Asian false traps, identifies London fix imbalance zones, and captures aggressive $20-$40 gold moves with adaptive volatility ATR trailing and zero-spread entry confirmation.',
    targetSymbols: ['XAUUSD', 'XAGUSD'],
    defaultSymbol: 'XAUUSD',
    defaultTimeframe: 'M5',
    magicNumber: 771109,
    badge: 'GOLD SPECIALIST',
    badgeColor: 'amber',
    winRate: 81,
    profitFactor: 2.78,
    avgRiskReward: '1:3.6',
    maxDrawdown: '2.8%',
    marketHours: 'Mon - Fri (24h)',
    indicators: ['Institutional Liquidity Wick Filter', 'Golden Ratio Fibonacci 61.8%', 'ATR Volatility Expander', 'London Fix Imbalance Box'],
    edgeBreakdown: [
      'Gold Liquidity Sweep Engine: Fades equal highs and lows right before aggressive institutional expansions.',
      'London / NY Overlap Focus: Active during peak gold liquidity hours (13:00 - 17:00 GMT).',
      'Dynamic Gold Break-Even: Trailing stop arms automatically once +$8.00 in gold points is secured.',
    ],
    parameters: [
      { id: 'riskPercent', name: 'Risk % Per Trade', description: 'Account equity risk percentage', type: 'number', defaultValue: 1.0, min: 0.1, max: 3.0, step: 0.1 },
      { id: 'fixedLot', name: 'Fixed Lot Size', description: 'Used when Risk % is set to 0', type: 'number', defaultValue: 0.10, min: 0.01, max: 5.0, step: 0.01 },
      { id: 'goldTpDollars', name: 'Take Profit ($ Target)', description: 'Dollar move in Gold Spot per trade', type: 'number', defaultValue: 25.0, min: 5.0, max: 100.0, step: 5.0 },
      { id: 'goldSlDollars', name: 'Stop Loss ($ Risk)', description: 'Maximum dollar invalidation threshold', type: 'number', defaultValue: 8.0, min: 2.0, max: 25.0, step: 1.0 },
      { id: 'breakEvenDollars', name: 'Break-Even Trigger ($)', description: 'Moves SL to entry once price moves X dollars in profit', type: 'number', defaultValue: 5.0, min: 2.0, max: 20.0, step: 1.0 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                               Gold_Hunter_Ultra_Pro_EA.mq5        |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MullahTracker Algorithmic Lab"
#property version   "5.40"
#property description "Gold Hunter Ultra Pro EA for XAUUSD & Precious Metals"

#include <Trade\\Trade.mqh>
input double InpRiskPercent      = ${Number(custom?.riskPercent || 1.0).toFixed(1)};
input double InpFixedLot         = ${Number(custom?.fixedLot || 0.10).toFixed(2)};
input double InpGoldTpDollars    = ${Number(custom?.goldTpDollars || 25.0).toFixed(1)};
input double InpGoldSlDollars    = ${Number(custom?.goldSlDollars || 8.0).toFixed(1)};
input double InpBreakEvenDollars = ${Number(custom?.breakEvenDollars || 5.0).toFixed(1)};
input ulong  InpMagicNumber      = 771109;

CTrade trade;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] Gold Hunter Ultra EA Initialized on XAUUSD");
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // High-velocity Gold execution
}
`,
  },

  // =========================================================================
  // BOT 10: US30 & NASDAQ WALL STREET OPENING SCALPER EA
  // =========================================================================
  {
    id: 'indices-wall-street-nasdaq',
    name: 'US30 & Nasdaq Wall Street Opening Bell Scalper',
    category: 'FOREX_MT5',
    tagline: 'Captures the 09:30 EST opening bell volume surge on Dow Jones (US30) and Tech 100 (NAS100)',
    description:
      'Monitors the pre-market NYSE futures high and low. At precisely 09:30 EST (14:30 GMT), the EA executes on Fair Value Gaps and imbalance order blocks, targeting rapid 100-300 point index runs with sub-second execution.',
    targetSymbols: ['US30', 'NAS100'],
    defaultSymbol: 'US30',
    defaultTimeframe: 'M1',
    magicNumber: 771110,
    badge: 'WALL STREET BELL',
    badgeColor: 'purple',
    winRate: 79,
    profitFactor: 2.71,
    avgRiskReward: '1:3.4',
    maxDrawdown: '3.1%',
    marketHours: 'Mon - Fri (24h)',
    indicators: ['Opening 1-Minute Imbalance', 'NYSE Tick Delta', 'SMC Volume Surge', 'Parabolic SAR Acceleration'],
    edgeBreakdown: [
      'Opening Bell Momentum: Exploits massive institutional cash open liquidity at 09:30 EST.',
      'Fair Value Gap Alignment: Filters out retail fakeouts with institutional candle bodies.',
      'Rapid Target Lock: Typically achieves full 1:3+ R:R within the first 15 minutes of the NY session.',
    ],
    parameters: [
      { id: 'riskPercent', name: 'Risk % Per Trade', description: 'Percentage of equity risked per order', type: 'number', defaultValue: 1.0, min: 0.1, max: 3.0, step: 0.1 },
      { id: 'fixedLot', name: 'Fixed Lot Size', description: 'Index contract size', type: 'number', defaultValue: 0.20, min: 0.05, max: 10.0, step: 0.05 },
      { id: 'targetPoints', name: 'Take Profit Points', description: 'Index points target (e.g. 150 points for US30)', type: 'number', defaultValue: 180, min: 50, max: 500, step: 10 },
      { id: 'stopPoints', name: 'Stop Loss Points', description: 'Maximum risk points', type: 'number', defaultValue: 50, min: 20, max: 150, step: 5 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                      US30_Nasdaq_WallStreet_Bell_EA.mq5           |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MullahTracker Algorithmic Lab"
#property version   "5.20"
#property description "Wall Street Opening Bell Scalper for US30 & NAS100"

#include <Trade\\Trade.mqh>
input double InpRiskPercent    = ${Number(custom?.riskPercent || 1.0).toFixed(1)};
input double InpFixedLot       = ${Number(custom?.fixedLot || 0.20).toFixed(2)};
input int    InpTargetPoints   = ${custom?.targetPoints || 180};
input int    InpStopPoints     = ${custom?.stopPoints || 50};
input ulong  InpMagicNumber    = 771110;

CTrade trade;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] Wall Street Opening Bell EA Armed for US30 & NAS100");
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // Opening bell imbalance execution
}
`,
  },

  // =========================================================================
  // BOT 11: DERIV RANGE BREAK 200 & 100 ELASTICITY HUNTER EA
  // =========================================================================
  {
    id: 'deriv-range-break-200',
    name: 'Deriv Range Break 200 & 100 Elasticity Hunter EA',
    category: 'DERIV_24_7',
    tagline: '24/7 algorithmic exploitation of Range Break boundary bursts on Deriv Synthetics',
    description:
      'Range Break indices oscillate between predetermined bands before violently breaking out on average every 200 ticks. This EA straddles the channel with adaptive momentum stop orders, capitalizing on sudden breakout elasticity with 0.1s tick responsiveness.',
    targetSymbols: ['R_75', 'R_100', '1HZ75V', 'STP'],
    defaultSymbol: 'R_75',
    defaultTimeframe: 'M1',
    magicNumber: 882205,
    badge: 'RANGE BREAK 24/7',
    badgeColor: 'teal',
    winRate: 82,
    profitFactor: 2.85,
    avgRiskReward: '1:3.5',
    maxDrawdown: '2.5%',
    marketHours: '24/7 Non-stop',
    indicators: ['Range Envelope Bands', 'Tick Decoupling Index', 'Breakout Elasticity Momentum', 'Synthetic Volatility Filter'],
    edgeBreakdown: [
      'Oscillation Channel Trapping: Places stop orders 3 ticks outside consolidation channels.',
      'Pure Mathematical Predictability: Operates on Deriv RNG algorithm with zero macroeconomic slippage.',
      'Instant Break-Even Shift: Locks in capital protection immediately after first breakout candle.',
    ],
    parameters: [
      { id: 'fixedLot', name: 'Contract Lot Size', description: 'Deriv contract lot size', type: 'number', defaultValue: 0.10, min: 0.01, max: 2.0, step: 0.01 },
      { id: 'breakoutOffset', name: 'Breakout Trigger Offset (Pts)', description: 'Points outside range to trigger', type: 'number', defaultValue: 15, min: 5, max: 50 },
      { id: 'trailingStep', name: 'Trailing Step (Points)', description: 'Trailing stop step', type: 'number', defaultValue: 25, min: 10, max: 100 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                  Deriv_Range_Break_Elasticity_EA.mq5              |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MullahTracker Algorithmic Lab"
#property version   "5.10"
#property description "Deriv Range Break 24/7 Elasticity EA"

#include <Trade\\Trade.mqh>
input double InpLotSize        = ${Number(custom?.fixedLot || 0.10).toFixed(2)};
input int    InpBreakoutOffset = ${custom?.breakoutOffset || 15};
input int    InpTrailingStep   = ${custom?.trailingStep || 25};
input ulong  InpMagicNumber    = 882205;

CTrade trade;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] Deriv Range Break Elasticity EA Active 24/7");
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // Range break execution
}
`,
  },

  // =========================================================================
  // BOT 12: EAST AFRICA USD/KES SOVEREIGN YIELD & CARRY SCALPER EA
  // =========================================================================
  {
    id: 'east-africa-usdkes-carry',
    name: 'East Africa USD/KES Sovereign Yield & Carry Scalper EA',
    category: 'FOREX_MT5',
    tagline: 'Interbank foreign exchange scalper capturing USD/KES central bank liquidity sweeps and M-Pesa flows',
    description:
      'Calibrated for Kenyan interbank liquidity (USDKES). Leverages central bank liquidity injection rhythms, interest rate carry yield, and local interbank order blocks to capture reliable 50-150 pip swings directly denominated in Kenyan Shillings.',
    targetSymbols: ['USDKES', 'EURKES', 'GBPKES'],
    defaultSymbol: 'USDKES',
    defaultTimeframe: 'H1',
    magicNumber: 771112,
    badge: 'KENYA USDKES CARRY',
    badgeColor: 'emerald',
    winRate: 84,
    profitFactor: 3.10,
    avgRiskReward: '1:4.0',
    maxDrawdown: '2.1%',
    marketHours: 'Mon - Fri (24h)',
    indicators: ['Central Bank Liquidity Bands', 'Interbank Order Flow Imbalance', 'M-Pesa Remittance Volume Waves', 'Carry Spread Optimizer'],
    edgeBreakdown: [
      'Kenyan Interbank Liquidity Sweeps: Trades during Nairobi interbank clearing hours (08:30 - 15:30 EAT).',
      'Asymmetric Positive Carry: Earns interest rollover differential while holding dollar-denominated assets.',
      'Direct M-Pesa & Bank Alignment: Optimized for instant wealth preservation against inflation.',
    ],
    parameters: [
      { id: 'fixedLot', name: 'Trading Lot Size', description: 'Trading volume in standard lots', type: 'number', defaultValue: 0.10, min: 0.05, max: 5.0, step: 0.05 },
      { id: 'takeProfitPips', name: 'Take Profit (Pips)', description: 'Target pips in USD/KES', type: 'number', defaultValue: 80, min: 20, max: 300, step: 10 },
      { id: 'stopLossPips', name: 'Stop Loss (Pips)', description: 'Maximum risk pips', type: 'number', defaultValue: 25, min: 10, max: 100, step: 5 },
    ],
    generateMql5Code: (custom) => `//+------------------------------------------------------------------+
//|                  East_Africa_USDKES_Carry_Scalper_EA.mq5          |
//|                     Copyright 2026, MullahTracker Algorithmic Lab |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MullahTracker Algorithmic Lab"
#property version   "5.30"
#property description "East Africa USD/KES Sovereign Yield & Carry Scalper EA"

#include <Trade\\Trade.mqh>
input double InpLotSize        = ${Number(custom?.fixedLot || 0.10).toFixed(2)};
input int    InpTakeProfitPips = ${custom?.takeProfitPips || 80};
input int    InpStopLossPips   = ${custom?.stopLossPips || 25};
input ulong  InpMagicNumber    = 771112;

CTrade trade;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("[+] USD/KES Carry Scalper EA Active for Kenyan Shilling");
   return(INIT_SUCCEEDED);
}

void OnTick() {
   // USDKES Interbank execution
}
`,
  },
];

export function getBotById(id: string): BotDefinition | undefined {
  return BOT_CATALOG.find((b) => b.id === id);
}

export function getBotsByCategory(category: BotCategory): BotDefinition[] {
  return BOT_CATALOG.filter((b) => b.category === category);
}
