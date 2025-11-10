/**
 * Calculate delivery fee
 * 
 * @param {Object} order - The order object
 * @param {Object} delivery - Delivery information with zone and rush properties (optional if order.delivery exists)
 * @param {Object} profile - Customer profile with tier property (optional if order.customer exists)
 * @returns {number} - Delivery fee in cents
 */
function deliveryFee(order, delivery, profile) {
  // Extract delivery and customer from order if not provided separately
  const deliveryInfo = delivery || order.delivery || { zone: 'local', rush: false, distanceKm: 1 };
  const customer = profile || order.customer || { tier: 'guest' };
  
  // Calculate discounted subtotal for free delivery threshold
  let discountedSubtotal = 0;
  for (const item of order.items) {
    discountedSubtotal += item.unitPriceCents * item.qty;
  }

  // Apply volume discounts to subtotal
  const volumeDiscounts = {
    'guest': { 12: 0.05, 24: 0.10 },
    'regular': { 12: 0.08, 24: 0.12 },
    'vip': { 12: 0.05, 24: 0.10 }
  };

  // Fetch discounts based on customer's tier
  const tierDiscounts = volumeDiscounts[customer.tier] || volumeDiscounts['guest'];
  let totalVolumeDiscount = 0;

  for (const item of order.items) {
    let itemSubtotal = item.unitPriceCents * item.qty;
    if (item.qty >= 24 && tierDiscounts[24]) {
      totalVolumeDiscount += Math.floor(itemSubtotal * tierDiscounts[24]);
    } else if (item.qty >= 12 && tierDiscounts[12]) {
      totalVolumeDiscount += Math.floor(itemSubtotal * tierDiscounts[12]);
    }
  }

  discountedSubtotal -= totalVolumeDiscount;

  const freeDeliveryThresholds = {
    'guest': 5000,    // $50
    'regular': 4000,  // $40
    'vip': 3000       // $30
  };

  // Use tier-specific threshold, default to guest if tier not recognized
  let threshold = freeDeliveryThresholds[customer.tier];
  if (!threshold) {
    threshold = freeDeliveryThresholds['guest'];
  }

  if (discountedSubtotal > threshold) {
    if (deliveryInfo.rush) {
      return 299;
    }
    return 0;
  }

  // Base delivery fee by zone
  let fee = 0;

  for (const item of order.items) {
    if (deliveryInfo.zone === 'local') {
      fee += 399;
    } else if (deliveryInfo.zone === 'outer') {
      fee += 699;
    }
  }

  if (deliveryInfo.rush) {
    fee += 299;
  }

  return fee;
}

module.exports = { deliveryFee, delivery: deliveryFee };
