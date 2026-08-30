const tokenCache = {};

async function req(path, method = 'GET', body = null, tokenKey = 'main') {
  const headers = { 'Content-Type': 'application/json' };

  // Use a fake cookie since we're using cookies for auth, or Auth header depending on how it's built
  if (tokenCache[tokenKey]) {
    headers['Cookie'] = `accessToken=${tokenCache[tokenKey]}`;
    // Or Authorization if API accepts it
    headers['Authorization'] = `Bearer ${tokenCache[tokenKey]}`;
  }

  const options = {
    method,
    headers,
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`http://localhost:3000${path}`, options);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = await res.text();
  }

  if (res.headers.get('set-cookie')) {
    // Basic extraction
    const match = res.headers.get('set-cookie').match(/accessToken=([^;]+)/);
    if (match) {
      tokenCache[tokenKey] = match[1];
    }
  }

  return { status: res.status, data };
}

async function runTests() {
  console.log("Starting API Tests...\n");

  const email = `test_${Date.now()}@example.com`;
  const password = "Password123!";

  // 1. Auth Register
  console.log("1. Testing POST /api/v1/auth/register");
  const reg = await req('/api/v1/auth/register', 'POST', {
    email,
    password,
    name: "Test User",
    companyName: "Test Company",
    phone: "9876543210",
    pan: "ABCDE1234F",
    gstin: "27ABCDE1234F1Z5",
    addressLine1: "123 Test St",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001"
  });
  console.log(reg.status, reg.data);
  if (reg.status !== 200 && reg.status !== 201) return console.log("Register failed, stopping.");

  // 2. Auth Login
  console.log("\n2. Testing POST /api/v1/auth/login");
  const login = await req('/api/v1/auth/login', 'POST', { email, password });
  console.log(login.status, login.data);
  if (login.status !== 200) return console.log("Login failed, stopping.");

  // Save token for manual pass if cookie parsing failed
  if (login.data.data?.accessToken) {
    tokenCache['main'] = login.data.data.accessToken;
  }

  // 3. Get Me
  console.log("\n3. Testing GET /api/v1/company/me");
  const me = await req('/api/v1/company/me', 'GET');
  console.log(me.status, me.data);
  if (me.status !== 200) return console.log("Get Me failed, stopping.");

  // 4. Update Bank
  console.log("\n4. Testing PUT /api/v1/company/me/bank");
  const bank = await req('/api/v1/company/me/bank', 'PUT', {
    accountName: "Test Co",
    ifsc: "SBIN0123456",
    accountNumber: "1234567890"
  });
  console.log(bank.status, bank.data);

  // 5. Create Catalog Item
  console.log("\n5. Testing POST /api/v1/catalog");
  const catalog = await req('/api/v1/catalog', 'POST', {
    name: "Steel Pipe",
    description: "High quality steel",
    hsnCode: "7208",
    unitPrice: 1500,
    validTo: new Date(Date.now() + 86400000 * 30).toISOString()
  });
  console.log(catalog.status, catalog.data);

  // 6. Get Marketplace Requirements
  console.log("\n6. Testing GET /api/v1/marketplace/requirements");
  const market = await req('/api/v1/marketplace/requirements', 'GET');
  console.log(market.status, market.data);

  // 7. Admin Companies
  console.log("\n7. Testing GET /api/v1/admin/companies");
  const adminRes = await req('/api/v1/admin/companies');
  console.log(adminRes.status, JSON.stringify(adminRes.data, null, 2));

  console.log("\nBasic Endpoint Tests Finished.");
}

runTests().catch(console.error);
