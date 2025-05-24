// Global variables
let cryptoData = null;
let currentResults = null;
let searchTimeout = null;
const SEARCH_DELAY = 500; // milliseconds to wait after typing stops before searching

// Load crypto data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('crypto_data.json');
        cryptoData = await response.json();
        
        // Update last updated time
        if (document.getElementById('lastUpdated')) {
            document.getElementById('lastUpdated').textContent = cryptoData.generated_at;
        }
        
        console.log(`Loaded ${cryptoData.coins.length} coins`);
        
        // Set up help dropdown toggle
        setupHelpDropdown();
        
        // Set up auto-search on typing
        setupAutoSearch();
        
    } catch (error) {
        console.error('Error loading crypto data:', error);
        alert('Error loading cryptocurrency data. Please refresh the page.');
    }
});

// Set up help dropdown toggle functionality
function setupHelpDropdown() {
    const helpToggle = document.querySelector('.help-toggle');
    const usageGuide = document.getElementById('usageGuide');
    
    if (helpToggle && usageGuide) {
        helpToggle.addEventListener('click', () => {
            helpToggle.classList.toggle('active');
            usageGuide.classList.toggle('active');
        });
    }
}

// Set up auto-search as user types
function setupAutoSearch() {
    const tickersInput = document.getElementById('target_tickers');
    
    if (tickersInput) {
        tickersInput.addEventListener('input', () => {
            // Clear previous timeout
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            // Set new timeout to avoid searching on every keystroke
            searchTimeout = setTimeout(() => {
                const inputValue = tickersInput.value.trim();
                if (inputValue.length > 0) {
                    generateTokens();
                } else {
                    // Hide results if input is empty
                    document.getElementById('resultsContainer').style.display = 'none';
                    document.getElementById('exportContainer').style.display = 'none';
                }
            }, SEARCH_DELAY);
        });
    }
}

// Main function to generate tokens
async function generateTokens() {
    const tickersInput = document.getElementById('target_tickers').value;
    
    if (!tickersInput.trim()) {
        return;
    }
    
    if (!cryptoData) {
        alert('Cryptocurrency data is still loading. Please wait a moment and try again.');
        return;
    }
    
    // Hide previous results and prepare for new search
    showLoading();
    
    // Parse tickers
    const tickers = tickersInput.split(',').map(t => t.trim().toUpperCase()).filter(t => t);
    
    // Search for each ticker
    const results = [];
    for (const ticker of tickers) {
        const result = searchTicker(ticker);
        results.push(result);
    }
    
    // Store results globally
    currentResults = results;
    
    // Show results directly
    displayResults(results);
}

// Search for a ticker in the crypto data
function searchTicker(ticker) {
    // First check common mapping
    if (cryptoData.common_mapping[ticker]) {
        const coinId = cryptoData.common_mapping[ticker];
        const coin = cryptoData.coins.find(c => c.id === coinId);
        if (coin) {
            return {
                ticker: ticker,
                token_id: coin.id,
                link: `https://www.coingecko.com/en/coins/${coin.id}`,
                fuzzy_match: false,
                matched_ticker: coin.symbol
            };
        }
    }
    
    // Check symbol index for exact matches
    if (cryptoData.symbol_index[ticker]) {
        const coinIds = cryptoData.symbol_index[ticker];
        // Find the coin with highest market cap
        let bestCoin = null;
        let highestMarketCap = 0;
        
        for (const coinId of coinIds) {
            const coin = cryptoData.coins.find(c => c.id === coinId);
            if (coin && (coin.market_cap || 0) > highestMarketCap) {
                bestCoin = coin;
                highestMarketCap = coin.market_cap || 0;
            }
        }
        
        if (bestCoin) {
            return {
                ticker: ticker,
                token_id: bestCoin.id,
                link: `https://www.coingecko.com/en/coins/${bestCoin.id}`,
                fuzzy_match: false,
                matched_ticker: bestCoin.symbol
            };
        }
    }
    
    // Fuzzy matching
    const fuzzyMatch = findFuzzyMatch(ticker);
    if (fuzzyMatch) {
        return {
            ticker: ticker,
            token_id: fuzzyMatch.id,
            link: `https://www.coingecko.com/en/coins/${fuzzyMatch.id}`,
            fuzzy_match: true,
            matched_ticker: fuzzyMatch.symbol
        };
    }
    
    // Not found
    return {
        ticker: ticker,
        token_id: 'Not found',
        link: '',
        fuzzy_match: false,
        matched_ticker: null
    };
}

// Find fuzzy matches
function findFuzzyMatch(ticker) {
    const tickerLower = ticker.toLowerCase();
    const candidates = [];
    
    for (const coin of cryptoData.coins) {
        let score = 0;
        
        // Check if ID contains ticker
        if (coin.id === tickerLower) {
            score = 100;
        } else if (coin.id.includes(tickerLower) || coin.id.includes(tickerLower.replace(/[^a-z0-9]/g, ''))) {
            score = 80;
        }
        
        // Check if name contains ticker
        const nameLower = coin.name.toLowerCase();
        if (nameLower === tickerLower) {
            score = Math.max(score, 90);
        } else if (nameLower.split(/[\s-]/).includes(tickerLower)) {
            score = Math.max(score, 70);
        } else if (nameLower.includes(tickerLower)) {
            score = Math.max(score, 50);
        }
        
        // Check symbol similarity
        if (coin.symbol === ticker) {
            score = Math.max(score, 95);
        }
        
        if (score > 0) {
            // Boost score based on market cap
            const marketCapBoost = coin.market_cap ? Math.log10(Math.max(coin.market_cap, 1)) * 5 : 0;
            score += marketCapBoost;
            
            candidates.push({ coin, score });
        }
    }
    
    // Sort by score and return the best match
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0].coin : null;
}

// Display results
function displayResults(results) {
    // Show containers
    hideLoading(); // This now directly shows the containers
    
    // Update JSON view
    document.getElementById('result').textContent = JSON.stringify(results, null, 2);
    
    // Update table view
    updateTable(results);
}

// Update table based on selected columns
function updateTable(results) {
    const showTicker = document.getElementById('show_ticker').checked;
    const showId = document.getElementById('show_id').checked;
    const showLink = document.getElementById('show_link').checked;
    const showMatchType = document.getElementById('show_match_type').checked;
    
    // Update headers
    const thead = document.querySelector('#resultTable thead tr');
    thead.innerHTML = '';
    if (showTicker) thead.innerHTML += '<th>Ticker</th>';
    if (showId) thead.innerHTML += '<th>API ID</th>';
    if (showLink) thead.innerHTML += '<th>Link</th>';
    if (showMatchType) thead.innerHTML += '<th>Match Type</th>';
    
    // Update body
    const tbody = document.querySelector('#resultTable tbody');
    tbody.innerHTML = '';
    
    results.forEach(result => {
        const row = document.createElement('tr');
        
        if (showTicker) {
            const td = document.createElement('td');
            td.textContent = result.ticker;
            row.appendChild(td);
        }
        
        if (showId) {
            const td = document.createElement('td');
            td.textContent = result.token_id;
            row.appendChild(td);
        }
        
        if (showLink) {
            const td = document.createElement('td');
            if (result.link) {
                td.innerHTML = `<a href="${result.link}" target="_blank">View on CoinGecko</a>`;
            }
            row.appendChild(td);
        }
        
        if (showMatchType) {
            const td = document.createElement('td');
            if (result.fuzzy_match) {
                td.innerHTML = `<span class="fuzzy-match">Fuzzy match: ${result.matched_ticker}</span>`;
            } else {
                td.textContent = 'Exact match';
            }
            row.appendChild(td);
        }
        
        tbody.appendChild(row);
    });
}

// Tab switching
function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let content of tabContents) {
        content.classList.remove('active');
    }
    
    const tabButtons = document.getElementsByClassName('tab-button');
    for (let button of tabButtons) {
        button.classList.remove('active');
    }
    
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// Copy results to clipboard
function copyResult() {
    if (!currentResults) return;
    
    const showTicker = document.getElementById('show_ticker').checked;
    const showId = document.getElementById('show_id').checked;
    const showLink = document.getElementById('show_link').checked;
    const showMatchType = document.getElementById('show_match_type').checked;
    
    let resultText = '';
    currentResults.forEach(result => {
        const parts = [];
        if (showTicker) parts.push(result.ticker);
        if (showId) parts.push(result.token_id);
        if (showLink) parts.push(result.link || '');
        if (showMatchType) {
            parts.push(result.fuzzy_match ? `Fuzzy match: ${result.matched_ticker}` : 'Exact match');
        }
        resultText += parts.join('\t') + '\n';
    });
    
    navigator.clipboard.writeText(resultText)
        .then(() => alert('Results copied to clipboard!'))
        .catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy to clipboard. Please try again.');
        });
}

// Download results as CSV
function downloadCSV() {
    if (!currentResults) return;
    
    const showTicker = document.getElementById('show_ticker').checked;
    const showId = document.getElementById('show_id').checked;
    const showLink = document.getElementById('show_link').checked;
    const showMatchType = document.getElementById('show_match_type').checked;
    
    // Build headers
    const headers = [];
    if (showTicker) headers.push('Ticker');
    if (showId) headers.push('API ID');
    if (showLink) headers.push('Link');
    if (showMatchType) headers.push('Match Type');
    
    // Build CSV content
    let csvContent = headers.join(',') + '\n';
    
    currentResults.forEach(result => {
        const parts = [];
        if (showTicker) parts.push(result.ticker);
        if (showId) parts.push(result.token_id);
        if (showLink) parts.push(result.link || '');
        if (showMatchType) {
            parts.push(result.fuzzy_match ? `Fuzzy match: ${result.matched_ticker}` : 'Exact match');
        }
        csvContent += parts.map(p => `"${p}"`).join(',') + '\n';
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'coingecko_ids.csv';
    link.click();
}

// Loading UI
function showLoading() {
    // Removed loading container display to prevent UI movement
    document.getElementById('resultsContainer').style.display = 'none';
    document.getElementById('exportContainer').style.display = 'none';
}

function hideLoading() {
    // Simply show the results without delay
    document.getElementById('resultsContainer').style.display = 'block';
    document.getElementById('exportContainer').style.display = 'block';
}

// Listen for column checkbox changes to update table
document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = document.querySelectorAll('.column-option input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            if (currentResults) {
                updateTable(currentResults);
            }
        });
    });
}); 