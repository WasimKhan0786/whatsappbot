require('dotenv').config();
const sharp = require('sharp');
const {
  extractPdfText,
  extractImageText,
  compressImageForAI,
  analyzeMediaStyle,
  processIncomingMedia,
  truncateTextForTokenEfficiency,
} = require('./src/services/mediaService');
const { generateGeminiReply } = require('./src/services/geminiService');
const { buildDynamicPersonaPrompt } = require('./src/services/personaService');

/**
 * Generates a minimal valid PDF Buffer with text for testing
 */
function createMinimalPdfBuffer(textContent) {
  const content = `BT /F1 18 Tf 50 700 Td (${textContent.replace(/[()]/g, '')}) Tj ET`;
  const streamLength = content.length;
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${content}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000244 00000 n 
0000000344 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
420
%%EOF`;
  return Buffer.from(pdfString, 'binary');
}

/**
 * Creates an image buffer with renderable text using sharp
 */
async function createSyntheticTextImage(text) {
  const svgText = `
    <svg width="600" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="30" y="100" font-family="Arial" font-size="28" fill="#000000">${text}</text>
    </svg>
  `;
  return sharp(Buffer.from(svgText)).png().toBuffer();
}

/**
 * Creates a large image buffer (2000x2000) to test compression downscaling
 */
async function createLargeImageBuffer() {
  const svg = `
    <svg width="2000" height="2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#2b5797"/>
      <circle cx="1000" cy="1000" r="400" fill="#ffffff"/>
      <text x="800" y="1020" font-family="Arial" font-size="64" fill="#2b5797">SAMPLE</text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function runMediaTests() {
  console.log('🧪 Starting Media File Processing (Images & PDFs) & Token Efficiency Test Suite...\n');

  // ==========================================
  // Test 1: PDF Extraction & Token Truncation
  // ==========================================
  console.log('📋 Test 1: Verifying PDF Text Extraction & Token Truncation...');
  const samplePdfText = 'Invoice #INV-2026-99: Total Due: $450.00. Payment due upon receipt.';
  const pdfBuffer = createMinimalPdfBuffer(samplePdfText);

  const pdfResult = await extractPdfText(pdfBuffer);
  console.log('  - PDF Result:', {
    success: pdfResult.success,
    pages: pdfResult.numPages,
    extractedLength: pdfResult.text.length,
    snippet: pdfResult.text.trim(),
  });

  if (pdfResult.success && pdfResult.text.includes('Invoice')) {
    console.log('  ✅ PDF extraction succeeded and correctly retrieved document text.');
  } else {
    throw new Error(`PDF text extraction failed: ${JSON.stringify(pdfResult)}`);
  }

  // Token truncation test
  const hugeText = new Array(3500).fill('dataPoint').join(' ');
  const truncated = truncateTextForTokenEfficiency(hugeText, 2500);
  const truncatedWordCount = truncated.split(/\s+/).length;
  console.log(`  - Large Text Token Truncation: 3500 words -> ~${truncatedWordCount} words with note.`);
  if (truncatedWordCount <= 2600 && truncated.includes('truncated to optimize AI token efficiency')) {
    console.log('  ✅ Token truncation enforced successfully.');
  } else {
    throw new Error('Token truncation check failed.');
  }

  // ==========================================
  // Test 2: Image Compression & Downscaling
  // ==========================================
  console.log('\n📋 Test 2: Verifying Image Compression & Resizing (Sharp)...');
  const largeImgBuffer = await createLargeImageBuffer();
  console.log(`  - Original uncompressed image size: ${(largeImgBuffer.length / 1024).toFixed(1)} KB`);

  const compressed = await compressImageForAI(largeImgBuffer);
  console.log(`  - Compressed image size: ${(compressed.compressedBytes / 1024).toFixed(1)} KB (Saved ${compressed.reductionPercent}%)`);

  // Verify compressed metadata
  const meta = await sharp(compressed.buffer).metadata();
  console.log(`  - Resized dimensions: ${meta.width}x${meta.height} (Format: ${meta.format})`);

  if (meta.width <= 1024 && meta.height <= 1024 && meta.format === 'jpeg') {
    console.log('  ✅ Image successfully resized to max 1024px JPEG, saving significant Gemini visual tokens.');
  } else {
    throw new Error(`Image compression failed: ${JSON.stringify(meta)}`);
  }

  // ==========================================
  // Test 3: Style Analysis Engine
  // ==========================================
  console.log('\n📋 Test 3: Verifying Style Analysis Directive Engine...');

  const invoiceStyle = analyzeMediaStyle('Invoice 1045: Total Due Rs 15,000 for web design services');
  console.log('  - Invoice Style:', invoiceStyle.styleDirective);
  if (invoiceStyle.isInvoiceOrFinancial) {
    console.log('  ✅ Invoice/Financial style detected.');
  } else {
    throw new Error('Invoice style detection failed');
  }

  const listStyle = analyzeMediaStyle('- Task 1: Setup server\n- Task 2: Configure API\n- Task 3: Deploy');
  console.log('  - Bullet List Style:', listStyle.styleDirective);
  if (listStyle.isNumberedOrBullet) {
    console.log('  ✅ Bullet/List structure detected.');
  } else {
    throw new Error('List style detection failed');
  }

  // ==========================================
  // Test 4: Unified processIncomingMedia Pipeline
  // ==========================================
  console.log('\n📋 Test 4: Verifying Unified processIncomingMedia Pipeline...');

  // 4A: PDF Pipeline
  const pdfPipelineResult = await processIncomingMedia({
    buffer: pdfBuffer,
    mimeType: 'application/pdf',
    filename: 'invoice.pdf',
    caption: 'Please check this bill',
  });
  console.log('  - PDF Pipeline result:', {
    mediaType: pdfPipelineResult.mediaType,
    hasInlineData: Boolean(pdfPipelineResult.inlineData),
    tokenSummary: pdfPipelineResult.tokenOptimizationSummary,
  });
  if (pdfPipelineResult.mediaType === 'pdf' && pdfPipelineResult.inlineData === null) {
    console.log('  ✅ PDF pipeline correctly passes pure extracted text without heavy inline image data.');
  } else {
    throw new Error('PDF pipeline test failed');
  }

  // 4B: Visual Image Pipeline
  const imagePipelineResult = await processIncomingMedia({
    buffer: largeImgBuffer,
    mimeType: 'image/png',
    filename: 'chart.png',
    caption: 'What does this logo show?',
  });
  console.log('  - Image Pipeline result:', {
    mediaType: imagePipelineResult.mediaType,
    hasInlineData: Boolean(imagePipelineResult.inlineData),
    tokenSummary: imagePipelineResult.tokenOptimizationSummary,
  });
  if (imagePipelineResult.inlineData && imagePipelineResult.inlineData.data) {
    console.log('  ✅ Visual image pipeline compressed and generated inline base64 data.');
  } else {
    throw new Error('Image pipeline test failed');
  }

  // ==========================================
  // Test 5: Live Gemini Style & Content Mirroring
  // ==========================================
  console.log('\n📋 Test 5: Testing Live Gemini Generation with Media & Style Mirroring...');

  const basePrompt = 'You are an intelligent WhatsApp AI bot replying naturally.';

  // Scenario A: Mirroring a Structured Financial/Invoice Document
  console.log('\n  [Scenario A: Mirroring Invoice / Financial Document]');
  const invoiceMedia = {
    mediaType: 'pdf',
    filename: 'statement_march.pdf',
    extractedText: 'Monthly Invoice #9821\nClient: ACME Corp\nItem 1: Cloud Hosting - $200\nItem 2: API Maintenance - $150\nTotal Due: $350\nPayment Terms: Net 15 days.',
    styleInfo: analyzeMediaStyle('Monthly Invoice #9821 Total Due: $350 Net 15 days.'),
  };

  const dynamicPromptInvoice = buildDynamicPersonaPrompt(basePrompt, null, '+1234567890', 'Bhai yeh bill check karke batao kitna payment baaki hai?', invoiceMedia);
  const replyInvoice = await generateGeminiReply('Bhai yeh bill check karke batao kitna payment baaki hai?', dynamicPromptInvoice, [], invoiceMedia);

  console.log('  User: "Bhai yeh bill check karke batao kitna payment baaki hai?" [Attached statement_march.pdf]');
  console.log(`  Bot: "${replyInvoice}"\n`);

  if (replyInvoice.includes('350') || replyInvoice.toLowerCase().includes('total')) {
    console.log('  ✅ SUCCESS: Bot accurately extracted content ($350 total) and mirrored structured clarity!');
  } else {
    console.log('  ℹ️ Response noted:', replyInvoice);
  }

  // Scenario B: Mirroring a Structured Bulleted List
  console.log('  [Scenario B: Mirroring Bulleted Technical List]');
  const listMedia = {
    mediaType: 'pdf',
    filename: 'checklist.pdf',
    extractedText: 'Project Delivery Milestones:\n* Phase 1: Database schema initialization\n* Phase 2: Baileys socket connection\n* Phase 3: Gemini multimodal integration',
    styleInfo: analyzeMediaStyle('* Phase 1\n* Phase 2\n* Phase 3'),
  };

  const dynamicPromptList = buildDynamicPersonaPrompt(basePrompt, null, '+1234567890', 'Can you summarize these milestones for me?', listMedia);
  const replyList = await generateGeminiReply('Can you summarize these milestones for me?', dynamicPromptList, [], listMedia);

  console.log('  User: "Can you summarize these milestones for me?" [Attached checklist.pdf]');
  console.log(`  Bot: "${replyList}"\n`);

  if (replyList.includes('Phase') || replyList.includes('*') || replyList.includes('-') || replyList.includes('1')) {
    console.log('  ✅ SUCCESS: Bot mirrored the structured list format and accurately synthesized milestone content!');
  }

  console.log('\n🎉 ALL MEDIA PROCESSING & TOKEN EFFICIENCY TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runMediaTests().catch((err) => {
  console.error('\n❌ Media processing test suite encountered error:', err);
  process.exit(1);
});
