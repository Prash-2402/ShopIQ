/**
 * ESC/POS Thermal Receipt formatting utility.
 * Supports formatting bills for 58mm (32 characters) and 80mm (48 characters) printers.
 * Generates both readable text and raw ESC/POS binary buffers.
 */

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ReceiptData {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  billNumber: string;
  date: Date;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  total: number;
}

// ESC/POS Command constants
const ESC = 0x1b;
const GS = 0x1d;

export const ESC_POS = {
  INIT: new Uint8Array([ESC, 0x40]), // ESC @
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]), // ESC a 0
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]), // ESC a 1
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]), // ESC a 2
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]), // ESC E 1
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]), // ESC E 0
  DOUBLE_SIZE_ON: new Uint8Array([GS, 0x21, 0x11]), // GS ! 17 (Double width + height)
  DOUBLE_SIZE_OFF: new Uint8Array([GS, 0x21, 0x00]), // GS ! 0
  FEED_AND_CUT: new Uint8Array([GS, 0x56, 0x41, 0x00]), // GS V A 0
  LINE_FEED: new Uint8Array([0x0a]),
};

export class ThermalReceiptCompiler {
  private widthChars: number;

  constructor(private printerWidth: '58mm' | '80mm' = '58mm') {
    this.widthChars = printerWidth === '58mm' ? 32 : 48;
  }

  /**
   * Helper to format a line with text aligned left and right.
   */
  private formatLeftRight(left: string, right: string): string {
    const spaceCount = this.widthChars - (left.length + right.length);
    if (spaceCount <= 0) {
      // If text exceeds width, truncate left
      const availableLeftWidth = this.widthChars - right.length - 1;
      return left.substring(0, availableLeftWidth) + ' ' + right;
    }
    return left + ' '.repeat(spaceCount) + right;
  }

  /**
   * Generate clean dashed divider line.
   */
  private getDivider(): string {
    return '-'.repeat(this.widthChars);
  }

  /**
   * Generate clean double line.
   */
  private getDoubleDivider(): string {
    return '='.repeat(this.widthChars);
  }

  /**
   * Formats string centering it to current printer width.
   */
  private centerText(text: string): string {
    if (text.length >= this.widthChars) {
      return text.substring(0, this.widthChars);
    }
    const leftPad = Math.floor((this.widthChars - text.length) / 2);
    return ' '.repeat(leftPad) + text;
  }

  /**
   * Generates a plain-text preview of the receipt.
   */
  public compileToText(data: ReceiptData): string {
    const lines: string[] = [];

    // Header
    lines.push(this.centerText(data.storeName.toUpperCase()));
    if (data.storeAddress) lines.push(this.centerText(data.storeAddress));
    if (data.storePhone) lines.push(this.centerText(`Ph: ${data.storePhone}`));
    lines.push(this.getDivider());

    // Invoice Info
    lines.push(`Bill No: ${data.billNumber}`);
    lines.push(`Date: ${data.date.toLocaleString()}`);
    lines.push(this.getDoubleDivider());

    // Table Header
    if (this.printerWidth === '58mm') {
      // 58mm Header: Items are compact
      lines.push(this.formatLeftRight('Item (Qty x Price)', 'Amount'));
    } else {
      // 80mm Header: More tabular space
      // Total 48 chars: Name(24) Qty(6) Price(8) Total(10)
      const name = 'Item Description'.padEnd(24);
      const qty = 'Qty'.padStart(6);
      const price = 'Price'.padStart(8);
      const amt = 'Amount'.padStart(10);
      lines.push(name + qty + price + amt);
    }
    lines.push(this.getDivider());

    // Items list
    data.items.forEach((item) => {
      const amtStr = `₹${(item.quantity * item.price).toFixed(2)}`;
      if (this.printerWidth === '58mm') {
        const itemLine = `${item.name}`;
        const qtyPriceLine = `  ${item.quantity} x ₹${item.price.toFixed(2)}`;
        lines.push(itemLine);
        lines.push(this.formatLeftRight(qtyPriceLine, amtStr));
      } else {
        const itemStr = item.name.length > 22 ? item.name.substring(0, 22) + '..' : item.name;
        const nameCol = itemStr.padEnd(24);
        const qtyCol = item.quantity.toString().padStart(6);
        const priceCol = `₹${item.price.toFixed(2)}`.padStart(8);
        const amtCol = amtStr.padStart(10);
        lines.push(nameCol + qtyCol + priceCol + amtCol);
      }
    });

    lines.push(this.getDoubleDivider());

    // Financial calculations
    lines.push(this.formatLeftRight('Subtotal:', `₹${data.subtotal.toFixed(2)}`));
    if (data.discount && data.discount > 0) {
      lines.push(this.formatLeftRight('Discount:', `-₹${data.discount.toFixed(2)}`));
    }
    lines.push(this.getDivider());
    lines.push(this.formatLeftRight('GRAND TOTAL:', `₹${data.total.toFixed(2)}`));
    lines.push(this.getDoubleDivider());

    // Footer
    lines.push(this.centerText('Thank You for Shopping!'));
    lines.push(this.centerText('Powered by AI Kirana Billing'));
    lines.push('\n\n'); // Feed spacing at bottom

    return lines.join('\n');
  }

  /**
   * Compiles ReceiptData to raw ESC/POS binary codes.
   */
  public compileToBytes(data: ReceiptData): Uint8Array {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    // Initialize printer
    parts.push(ESC_POS.INIT);

    // Store Name: Centered, Bold, Double Size
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push(ESC_POS.BOLD_ON);
    parts.push(ESC_POS.DOUBLE_SIZE_ON);
    parts.push(encoder.encode(data.storeName.toUpperCase() + '\n'));
    parts.push(ESC_POS.DOUBLE_SIZE_OFF);
    parts.push(ESC_POS.BOLD_OFF);

    // Address & Phone: Centered, Regular
    if (data.storeAddress) {
      parts.push(encoder.encode(data.storeAddress + '\n'));
    }
    if (data.storePhone) {
      parts.push(encoder.encode(`Ph: ${data.storePhone}\n`));
    }

    // Divider
    parts.push(ESC_POS.ALIGN_LEFT);
    parts.push(encoder.encode(this.getDivider() + '\n'));

    // Info Section
    parts.push(encoder.encode(`Bill No: ${data.billNumber}\n`));
    parts.push(encoder.encode(`Date: ${data.date.toLocaleString()}\n`));
    parts.push(encoder.encode(this.getDoubleDivider() + '\n'));

    // Table Header
    parts.push(ESC_POS.BOLD_ON);
    if (this.printerWidth === '58mm') {
      parts.push(encoder.encode(this.formatLeftRight('Item (Qty x Price)', 'Amount') + '\n'));
    } else {
      const name = 'Item Description'.padEnd(24);
      const qty = 'Qty'.padStart(6);
      const price = 'Price'.padStart(8);
      const amt = 'Amount'.padStart(10);
      parts.push(encoder.encode(name + qty + price + amt + '\n'));
    }
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(encoder.encode(this.getDivider() + '\n'));

    // Items list
    data.items.forEach((item) => {
      const amtStr = `₹${(item.quantity * item.price).toFixed(2)}`;
      if (this.printerWidth === '58mm') {
        parts.push(encoder.encode(`${item.name}\n`));
        const qtyPriceLine = `  ${item.quantity} x ₹${item.price.toFixed(2)}`;
        parts.push(encoder.encode(this.formatLeftRight(qtyPriceLine, amtStr) + '\n'));
      } else {
        const itemStr = item.name.length > 22 ? item.name.substring(0, 22) + '..' : item.name;
        const nameCol = itemStr.padEnd(24);
        const qtyCol = item.quantity.toString().padStart(6);
        const priceCol = `₹${item.price.toFixed(2)}`.padStart(8);
        const amtCol = amtStr.padStart(10);
        parts.push(encoder.encode(nameCol + qtyCol + priceCol + amtCol + '\n'));
      }
    });

    parts.push(encoder.encode(this.getDoubleDivider() + '\n'));

    // Financial summaries
    parts.push(encoder.encode(this.formatLeftRight('Subtotal:', `₹${data.subtotal.toFixed(2)}`) + '\n'));
    if (data.discount && data.discount > 0) {
      parts.push(encoder.encode(this.formatLeftRight('Discount:', `-₹${data.discount.toFixed(2)}`) + '\n'));
    }
    parts.push(encoder.encode(this.getDivider() + '\n'));

    // Grand total: Bold
    parts.push(ESC_POS.BOLD_ON);
    parts.push(encoder.encode(this.formatLeftRight('GRAND TOTAL:', `₹${data.total.toFixed(2)}`) + '\n'));
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(encoder.encode(this.getDoubleDivider() + '\n'));

    // Footer
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push(encoder.encode('Thank You for Shopping!\n'));
    parts.push(encoder.encode('Powered by AI Kirana Billing\n'));

    // Feed and Cut
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.FEED_AND_CUT);

    // Merge all buffers into one flat Uint8Array
    const totalLength = parts.reduce((acc, val) => acc + val.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    parts.forEach((part) => {
      result.set(part, offset);
      offset += part.length;
    });

    return result;
  }
}
export default ThermalReceiptCompiler;
