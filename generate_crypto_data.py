import requests
import json
import time
from typing import Dict, List
from common_mapping import COMMON_CRYPTO_MAPPING

def fetch_all_coins() -> List[Dict]:
    """Fetch all coins from CoinGecko API."""
    print("Fetching all coins from CoinGecko...")
    try:
        response = requests.get('https://api.coingecko.com/api/v3/coins/list?include_platform=false')
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching coin list: {e}")
        return []

def fetch_market_data() -> Dict[str, Dict]:
    """Fetch market data for top coins by market cap."""
    print("Fetching market data for top coins...")
    market_data = {}
    
    # Fetch multiple pages to get more market data
    for page in range(1, 21):  # Get top 2000 coins (100 per page)
        try:
            url = "https://api.coingecko.com/api/v3/coins/markets"
            params = {
                'vs_currency': 'usd',
                'order': 'market_cap_desc',
                'per_page': 100,
                'page': page,
                'sparkline': False
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            coins = response.json()
            
            for coin in coins:
                market_data[coin['id']] = {
                    'market_cap': coin.get('market_cap', 0),
                    'market_cap_rank': coin.get('market_cap_rank', 0),
                    'price': coin.get('current_price', 0),
                    'volume_24h': coin.get('total_volume', 0)
                }
            
            print(f"Fetched page {page}/20")
            time.sleep(1)  # Rate limiting
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching market data page {page}: {e}")
            if "429" in str(e):
                print("Rate limit hit, waiting 30 seconds...")
                time.sleep(30)
                continue
            break
    
    return market_data

def generate_crypto_data():
    """Generate comprehensive cryptocurrency data for the static site."""
    # Fetch all coins
    all_coins = fetch_all_coins()
    if not all_coins:
        print("Failed to fetch coin data")
        return
    
    print(f"Fetched {len(all_coins)} coins")
    
    # Fetch market data
    market_data = fetch_market_data()
    print(f"Fetched market data for {len(market_data)} coins")
    
    # Create the data structure for the static site
    crypto_data = {
        'coins': [],
        'symbol_index': {},  # Maps symbols to coin IDs
        'common_mapping': COMMON_CRYPTO_MAPPING,
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())
    }
    
    # Process all coins
    for coin in all_coins:
        coin_id = coin['id']
        symbol = coin['symbol'].upper()
        
        # Get market data if available
        market = market_data.get(coin_id, {})
        
        coin_data = {
            'id': coin_id,
            'symbol': symbol,
            'name': coin['name'],
            'market_cap': market.get('market_cap', 0),
            'market_cap_rank': market.get('market_cap_rank', 0)
        }
        
        crypto_data['coins'].append(coin_data)
        
        # Add to symbol index
        if symbol not in crypto_data['symbol_index']:
            crypto_data['symbol_index'][symbol] = []
        crypto_data['symbol_index'][symbol].append(coin_id)
    
    # Sort coins by market cap (descending)
    crypto_data['coins'].sort(key=lambda x: x['market_cap'] or 0, reverse=True)
    
    # Save to JSON file
    output_file = 'crypto_data.json'
    with open(output_file, 'w') as f:
        json.dump(crypto_data, f, separators=(',', ':'))
    
    print(f"Generated {output_file} with {len(crypto_data['coins'])} coins")
    print(f"File size: {len(json.dumps(crypto_data)) / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    generate_crypto_data() 