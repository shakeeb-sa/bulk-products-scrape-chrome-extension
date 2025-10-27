// popup.js

const extractBtn = document.getElementById('extractBtn');
const statusElem = document.getElementById('status');

extractBtn.addEventListener('click', async () => {
    extractBtn.disabled = true;
    statusElem.textContent = 'Getting tab info...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url) {
        try {
            const url = new URL(tab.url);
            const baseUrl = `${url.protocol}//${url.hostname}`;
            
            statusElem.textContent = 'Extracting products...';
            console.log(`Starting extraction from: ${baseUrl}`);
            
            const allProducts = await scrapeShopifyProducts(baseUrl);
            
            if (allProducts.length === 0) {
                statusElem.textContent = 'No products found or not a Shopify site.';
                extractBtn.disabled = false;
                return;
            }

            statusElem.textContent = 'Generating Excel file...';
            generateExcel(allProducts, url.hostname);
            
            statusElem.textContent = `Success! ${allProducts.length} variants exported.`;

        } catch (error) {
            console.error('Error during extraction:', error.message);
            statusElem.textContent = 'Error: See console for details.';
        }
    } else {
        statusElem.textContent = 'Could not get tab URL.';
    }

    setTimeout(() => {
        extractBtn.disabled = false;
        statusElem.textContent = '';
    }, 5000);
});

async function scrapeShopifyProducts(baseUrl) {
    const productsList = [];
    let page = 1;
    while (true) {
        const response = await fetch(`${baseUrl}/products.json?limit=250&page=${page}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (!data.products || data.products.length === 0) {
            break;
        }

        for (const product of data.products) {
            // --- NEW: Get the featured image URL ---
            // Check if the product has images, and if so, get the URL of the first one.
            const featuredImageUrl = (product.images && product.images.length > 0)
                ? product.images[0].src
                : ''; // If no images, leave it blank

            for (const variant of product.variants) {
                // --- MODIFIED: Add the image URL to the object ---
                productsList.push({
                    'Handle': product.handle,
                    'Title': product.title,
                    'Vendor': product.vendor,
                    'Type': product.product_type,
                    'Tags': product.tags.join(', '),
                    'Image URL': featuredImageUrl, // <-- ADDED THIS LINE
                    'Variant Title': variant.title,
                    'Price': variant.price,
                    'SKU': variant.sku,
                    'Available': variant.available,
                });
            }
        }
        console.log(`Fetched page ${page}, total variants so far: ${productsList.length}`);
        page++;
    }
    return productsList;
}

function generateExcel(data, hostname) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    const filename = `${hostname}_products.xlsx`;
    XLSX.writeFile(workbook, filename);
}