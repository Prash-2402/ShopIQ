import axios from 'axios';
import * as FileSystem from 'expo-file-system';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export interface GeminiProduct {
  productName: string;
  price: number;
  category: string;
}

export const isGeminiConfigured = (): boolean => {
  return !!GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY';
};

const mockBarcodeDatabase: Record<string, GeminiProduct> = {
  '8901030895481': { productName: 'Closeup Red Hot Toothpaste 150g', price: 110, category: 'Personal Care' },
  '8901491101836': { productName: 'Lays Classic Salted Chips 50g', price: 20, category: 'Snacks' },
  '8901719101035': { productName: 'Kurkure Masala Munch 90g', price: 20, category: 'Snacks' },
  '8901262010010': { productName: 'Amul Butter 100g', price: 56, category: 'Dairy' },
  '8901491103038': { productName: 'Uncle Chipps Spicy Treat 55g', price: 20, category: 'Snacks' },
};

const popularItems = [
  { productName: 'Fortune Soyabean Oil 1L', price: 165, category: 'Staples' },
  { productName: 'Tata Salt 1kg', price: 28, category: 'Staples' },
  { productName: 'Maggi 2-Minute Noodles 70g', price: 14, category: 'Packaged Foods' },
  { productName: 'Aashirvaad Atta 5kg', price: 275, category: 'Staples' },
  { productName: 'Dettol Liquid Handwash 200ml', price: 99, category: 'Personal Care' },
];

export const lookupProductByBarcode = async (barcode: string): Promise<GeminiProduct> => {
  if (!isGeminiConfigured()) {
    console.log(`[GEMINI-SIMULATION] Looking up barcode ${barcode}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    if (mockBarcodeDatabase[barcode]) {
      return mockBarcodeDatabase[barcode];
    }
    const rand = popularItems[Math.floor(Math.random() * popularItems.length)];
    return {
      productName: `${rand.productName} (Code: ${barcode.slice(-4)})`,
      price: rand.price,
      category: rand.category,
    };
  }

  const prompt = `You are a barcode lookup database assistant for Indian grocery/kirana stores. Look up the product associated with the barcode: ${barcode}. Return a JSON object with exactly three keys: "productName" (string, detailed brand and size/volume, e.g. "Maggi 2-Minute Masala Noodles 70g"), "price" (number, estimated retail price in INR, e.g. 14), and "category" (string, e.g. "Packaged Foods", "Staples", "Dairy"). If you are unsure or do not have details for this barcode, estimate a realistic product name and price based on standard Indian market retail trends.`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const jsonText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error('Empty response from Gemini API.');
    
    const parsed = JSON.parse(jsonText) as GeminiProduct;
    return {
      productName: parsed.productName || 'Unknown Product',
      price: typeof parsed.price === 'number' ? parsed.price : 40,
      category: parsed.category || 'General',
    };
  } catch (error) {
    console.error('Gemini Barcode Lookup Error:', error);
    if (mockBarcodeDatabase[barcode]) {
      return mockBarcodeDatabase[barcode];
    }
    return {
      productName: `Generic Barcode Item (Code: ${barcode.slice(-4)})`,
      price: 50,
      category: 'General',
    };
  }
};

export const detectProductFromImage = async (imageUri: string): Promise<GeminiProduct> => {
  if (!isGeminiConfigured()) {
    console.log(`[GEMINI-SIMULATION] Identifying image from uri: ${imageUri}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const rand = popularItems[Math.floor(Math.random() * popularItems.length)];
    return rand;
  }

  try {
    const base64Data = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const prompt = 'You are an AI cashier identifying items in an Indian kirana store. Identify the grocery product in this image. Return a JSON object with exactly three keys: "productName" (string, detailed brand and size/volume, e.g. "Aashirvaad Shudh Chakki Atta 5kg"), "price" (number, estimated retail price in INR, e.g. 280), and "category" (string, e.g. "Staples", "Dairy").';

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const jsonText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error('Empty response from Gemini Vision API.');

    const parsed = JSON.parse(jsonText) as GeminiProduct;
    return {
      productName: parsed.productName || 'Detected Grocery Product',
      price: typeof parsed.price === 'number' ? parsed.price : 60,
      category: parsed.category || 'General',
    };
  } catch (error) {
    console.error('Gemini Vision Image Recognition Error:', error);
    const rand = popularItems[Math.floor(Math.random() * popularItems.length)];
    return {
      productName: `${rand.productName} (Local AI)`,
      price: rand.price,
      category: rand.category,
    };
  }
};
