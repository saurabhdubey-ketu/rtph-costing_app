"""
fix_empty_city_pins.py
For any location with city: "" in customer_master.js,
null out postal_code if the PIN prefix does not match the location's state.
Empty city means we can't reliably determine the exact PIN.
"""
import re

MASTER_JS = r'C:\Projects\Costing_App\costing\ravasco-cds\masters\customer_master.js'

# State → valid first-2-digit PIN prefixes
STATE_PINS = {
    'Delhi':             ['11'],
    'Haryana':           ['12','13'],
    'Punjab':            ['14','15','16'],
    'Chandigarh':        ['16'],
    'Himachal Pradesh':  ['17'],
    'Jammu & Kashmir':   ['18','19'],
    'Ladakh':            ['18','19'],
    'Uttar Pradesh':     ['20','21','22','23','24','25','26','27','28'],
    'Uttarakhand':       ['24','25','26'],
    'Rajasthan':         ['30','31','32','33','34'],
    'Gujarat':           ['36','37','38','39'],
    'Maharashtra':       ['40','41','42','43','44'],
    'Goa':               ['40'],
    'Madhya Pradesh':    ['45','46','47','48'],
    'Chhattisgarh':      ['49'],
    'Telangana':         ['50'],
    'Andhra Pradesh':    ['51','52','53'],
    'Karnataka':         ['54','55','56','57','58','59'],
    'Tamil Nadu':        ['60','61','62','63','64','65','66'],
    'Kerala':            ['67','68','69'],
    'West Bengal':       ['70','71','72','73','74'],
    'Odisha':            ['75','76','77'],
    'Assam':             ['78','79'],
    'Meghalaya':         ['79'],
    'Manipur':           ['79'],
    'Mizoram':           ['79'],
    'Nagaland':          ['79'],
    'Tripura':           ['79'],
    'Arunachal Pradesh': ['79'],
    'Bihar':             ['80','81','84','85','88','89'],
    'Jharkhand':         ['81','82','83','86','87'],
    'Sikkim':            ['73'],
}

def pin_matches_state(pin_str, state):
    if not pin_str or pin_str == 'null' or not state:
        return True  # can't determine mismatch
    p2 = pin_str.lstrip('"').rstrip('"')[:2]
    valid = STATE_PINS.get(state, [])
    return not valid or p2 in valid

with open(MASTER_JS, 'r', encoding='utf-8') as f:
    content = f.read()

fixed = 0

def fix_loc(m):
    global fixed
    loc = m.group(0)
    # Only process empty-city locations
    cm = re.search(r'city:\s*"([^"]*)"', loc)
    if not cm or cm.group(1) != '':
        return loc
    # Get state and postal_code
    sm  = re.search(r'state:\s*"([^"]*)"', loc)
    pcm = re.search(r'postal_code:\s*("[\d]+")', loc)
    if not pcm:
        return loc  # already null or missing
    state = sm.group(1) if sm else ''
    pin   = pcm.group(1)  # e.g. "783369"
    if not pin_matches_state(pin, state):
        fixed += 1
        return loc.replace(f'postal_code: {pin}', 'postal_code: null')
    return loc

# Fix location sub-objects
new_content = re.sub(r'\{[^}]*id:\s*"CUS-[^"]*-\d+"[^}]*\}', fix_loc, content)

# Also fix single-site root records with empty city
def fix_root(m):
    global fixed
    line = m.group(0)
    cm  = re.search(r',\s*city:\s*"([^"]*)"', line)
    if not cm or cm.group(1) != '':
        return line
    sm  = re.search(r',\s*state:\s*"([^"]*)"', line)
    pcm = re.search(r',\s*postal_code:\s*("[\d]+")', line)
    if not pcm:
        return line
    state = sm.group(1) if sm else ''
    pin   = pcm.group(1)
    if not pin_matches_state(pin, state):
        fixed += 1
        return line.replace(f'postal_code: {pin}', 'postal_code: null')
    return line

new_content = re.sub(r'^\s*\{ id: "CUS-\d+".*$', fix_root, new_content, flags=re.MULTILINE)

with open(MASTER_JS, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Fixed {fixed} mismatched PIN/state entries (set to null).")
