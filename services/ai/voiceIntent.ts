export type VoiceIntentType = 'ADD_STOCK' | 'RECORD_SALE' | 'RECORD_PAYMENT' | 'UNKNOWN';

export interface VoiceIntent {
  type: VoiceIntentType;
  itemName?: string;
  quantity?: number;
  unit?: string;
  amount?: number;
  customerName?: string;
  confidence: 'high' | 'low';
}

const numberMap: Record<string, number> = {
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};

export function parseVoiceIntent(transcript: string): VoiceIntent {
  const text = transcript.toLowerCase();
  
  // 1. ADD_STOCK patterns
  const stockKeywords = ['aaya', 'aaye', 'received', 'stock', 'mila', 'box', 'packet', 'laya'];
  if (stockKeywords.some(w => text.includes(w))) {
    const unitRegex = /(?:(\d+|ek|do|teen|char|paanch|che|saat|aath|nau|das|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?(box|packet|kg|litre|liter|dozen|piece|pcs|g|ml)/i;
    const unitMatch = text.match(unitRegex);
    
    let quantity: number | undefined;
    let unit: string | undefined;
    let itemName: string | undefined;

    if (unitMatch) {
      if (unitMatch[1]) {
        quantity = numberMap[unitMatch[1]] ?? parseInt(unitMatch[1], 10);
      } else {
        quantity = 1; // Default to 1 if no number is specified before the unit
      }
      unit = unitMatch[2];
      
      const beforeUnit = transcript.substring(0, unitMatch.index);
      const afterUnit = transcript.substring((unitMatch.index || 0) + unitMatch[0].length);
      
      // Clean up action words from the rest
      let cleaned = afterUnit;
      stockKeywords.forEach(w => {
        cleaned = cleaned.replace(new RegExp(`\\b${w}\\b`, 'gi'), '');
      });
      cleaned = cleaned.trim();
      
      if (cleaned) {
        itemName = cleaned;
      } else if (beforeUnit.trim()) {
        itemName = beforeUnit.trim();
      }
    } else {
      // Fallback if no unit found but has numbers
      const numMatch = text.match(/(\d+|ek|do|teen|char|paanch|che|saat|aath|nau|das)/);
      if (numMatch) {
        quantity = numberMap[numMatch[1]] ?? parseInt(numMatch[1], 10);
      }
    }
    
    return {
      type: 'ADD_STOCK',
      itemName: itemName || undefined,
      quantity,
      unit,
      confidence: quantity !== undefined ? 'high' : 'low'
    };
  }
  
  // 2. RECORD_PAYMENT patterns
  const paymentKeywords = ['diya', 'diye', 'paid', 'payment', 'chukta', 'rupay', 'rupees'];
  if (paymentKeywords.some(w => text.includes(w))) {
    const amountMatch = text.match(/(\d+)/);
    let amount: number | undefined;
    if (amountMatch) {
      amount = parseInt(amountMatch[1], 10);
    }
    
    let customerName: string | undefined;
    const neMatch = transcript.match(/([a-zA-Z]+)\s+ne/i);
    if (neMatch) {
      customerName = neMatch[1];
    } else {
      const words = transcript.trim().split(/\s+/);
      if (words.length > 0 && !amountMatch?.includes(words[0])) {
        // Fallback: take the first word as customer name if it isn't a number
        customerName = words[0];
      }
    }
    
    return {
      type: 'RECORD_PAYMENT',
      customerName,
      amount,
      confidence: (customerName && amount) ? 'high' : 'low'
    };
  }

  // 3. RECORD_SALE patterns
  const saleKeywords = ['becha', 'beche', 'sold', 'sale', 'gaya', 'le gaye'];
  if (saleKeywords.some(w => text.includes(w))) {
    let quantity: number | undefined;
    const numMatch = text.match(/(\d+|ek|do|teen|char|paanch|che|saat|aath|nau|das)/);
    if (numMatch) {
      quantity = numberMap[numMatch[1]] ?? parseInt(numMatch[1], 10);
    }
    
    let remaining = transcript;
    saleKeywords.forEach(w => {
      remaining = remaining.replace(new RegExp(`\\b${w}\\b`, 'gi'), '');
    });
    if (numMatch) {
      remaining = remaining.replace(new RegExp(`\\b${numMatch[1]}\\b`, 'gi'), '');
    }
    
    const itemName = remaining.trim() || undefined;
    
    return {
      type: 'RECORD_SALE',
      itemName,
      quantity,
      confidence: itemName ? 'high' : 'low'
    };
  }
  
  return { type: 'UNKNOWN', confidence: 'low' };
}
