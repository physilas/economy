export function normalCDF(x) {
  const sign=x<0?-1:1,z=Math.abs(x)/Math.sqrt(2),t=1/(1+0.3275911*z);
  const erf=1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t)*Math.exp(-z*z);
  return (1+sign*erf)/2;
}

// European, cash-settled options; game-day volatility and zero financing rate.
export function optionPrice(spot,strike,days,volatility,type='call') {
  if(![spot,strike,days,volatility].every(Number.isFinite)||spot<=0||strike<=0)return 0;
  const intrinsic=Math.max(0,type==='call'?spot-strike:strike-spot);
  if(days<=0||volatility<=0)return intrinsic;
  const variance=volatility*Math.sqrt(days),d1=(Math.log(spot/strike)+.5*variance*variance)/variance,d2=d1-variance;
  const call=spot*normalCDF(d1)-strike*normalCDF(d2);
  return Math.max(0,type==='call'?call:call-spot+strike);
}
