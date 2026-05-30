export function chefTierLabel(totalHearts: number): string {
  if (totalHearts >= 1000) return "Legendary";
  if (totalHearts >= 500) return "Renowned";
  if (totalHearts >= 100) return "Celebrated";
  if (totalHearts >= 25) return "Rising";
  return "New";
}
