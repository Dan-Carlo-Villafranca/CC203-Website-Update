// Store all entries to easily calculate totals.
// INITIAL_ENTRIES is a variable created in app.html by Flask/Jinja.
let entries = {
    income: [],
    expense: [],
    liability: [],
    debtOwed: []
};

// Main function to run when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if initial data was successfully passed from Flask
    if (typeof INITIAL_ENTRIES !== 'undefined' && INITIAL_ENTRIES.length > 0) {

        // Populate the local 'entries' structure
        INITIAL_ENTRIES.forEach(entry => {
            const type = entry.transaction_type;
            const item = { id: entry.id, description: entry.description, amount: entry.amount };

            if (entries.hasOwnProperty(type)) {
                entries[type].push(item);
                // Render the item to the correct list
                renderNewItem(item, type, type + 'List');
            }
        });
    }

    // Calculate totals based on the loaded data
    calculateTotals();
});

// Function to handle the ADD request
async function addItem(type) {
    let descInput, amountInput, shareInput;

    switch(type) {
        case 'income':
            descInput = document.getElementById('incomeDesc');
            amountInput = document.getElementById('incomeAmount');
            break;
        case 'expense':
            descInput = document.getElementById('expenseDesc');
            amountInput = document.getElementById('expenseAmount');
            shareInput = document.getElementById('expenseShare');
            break;
        case 'liability':
            descInput = document.getElementById('liabilityDesc');
            amountInput = document.getElementById('liabilityAmount');
            break;
        case 'debtOwed':
            descInput = document.getElementById('debtOwedDesc');
            amountInput = document.getElementById('debtOwedAmount');
            break;
        default:
            return;
    }

    const description = descInput.value.trim();
    const amount = parseFloat(amountInput.value);

    if (description === '' || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid description and amount.");
        return;
    }

    try {
        const response = await fetch('/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, description, amount })
        });

        const result = await response.json();

        if (response.ok && result.success) {

            const entry = {
                id: result.id,
                description: result.description,
                amount: result.amount
            };
            entries[type].push(entry);

            renderNewItem(entry, type, type + 'List');

            descInput.value = '';
            amountInput.value = '';

            // ----------------------------------------------------
            // 🔹 SHARED EXPENSE FEATURE (Only activates for expenses)
            // ----------------------------------------------------
            if (type === 'expense') {
                const shareInput = document.getElementById('expenseShare');
                const rawFriends = shareInput.value.trim();

                if (rawFriends !== "") {
                    const friends = rawFriends
                        .split(",")
                        .map(f => f.trim())
                        .filter(f => f.length > 0);

                    if (friends.length > 0) {
                        const totalPeople = friends.length + 1; // you + friends
                        const shareAmount = entry.amount / totalPeople;

                        // Create debtOwed entry for each friend
                        for (const friend of friends) {
                        const frResponse = await fetch('/add', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'debtOwed',
                                description: `${friend} (Shared: ${entry.description})`,
                                amount: shareAmount
                            })
                        });

                        const frResult = await frResponse.json();

                        if (frResponse.ok && frResult.success) {

                            // Save to local memory
                            const friendEntry = {
                                id: frResult.id,
                                description: frResult.description,
                                amount: frResult.amount
                            };

                            entries.debtOwed.push(friendEntry);

                            // Show on screen instantly
                            renderNewItem(friendEntry, "debtOwed", "debtOwedList");
                        }
                    }
                    }
                }

                // clear the sharing input
                if (shareInput) shareInput.value = "";
            }

            calculateTotals();
        } else {
            alert("Error adding item: " + (result.error || "Unknown error"));
        }

    } catch (error) {
        console.error('Fetch error:', error);
        alert('An error occurred while connecting to the server.');
    }
}

// Function to handle the DELETE request
async function removeItem(id, type) {
    try {
        const response = await fetch(`/delete/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok && result.success) {
            entries[type] = entries[type].filter(item => item.id !== id);

            const itemElement = document.querySelector(`.item[data-id="${id}"][data-type="${type}"]`);
            if (itemElement) {
                itemElement.remove();
            }

            calculateTotals();
        } else {
            alert("Error removing item: " + (result.error || "Unknown error"));
        }
    } catch (error) {
        console.error('Fetch error:', error);
        alert('An error occurred while connecting to the server.');
    }
}

// Helper function to render a single new item
function renderNewItem(entry, type, listId) {
    const list = document.getElementById(listId);
    const newItem = document.createElement('div');
    newItem.classList.add('item');
    newItem.setAttribute('data-id', entry.id);
    newItem.setAttribute('data-type', type);

    let buttonText = 'Remove';
    if (type === 'liability') {
        buttonText = 'Paid Off';
    } else if (type === 'debtOwed') {
        buttonText = 'Paid Back';
    }

    newItem.innerHTML = `
        ${entry.description}: ₱${entry.amount.toFixed(2)}
        <button class="remove-btn" onclick="removeItem(${entry.id}, '${type}')">${buttonText}</button>
    `;
    list.appendChild(newItem);
}

function updatePeopleWhoOweYou() {
    const container = document.getElementById('peopleOweYou');
    container.innerHTML = '';

    const map = {};

    entries.debtOwed.forEach(item => {
        // Extract payer name from "Mark (Shared: Pizza)"
        let name = item.description;
        if (name.includes("(")) {
            name = name.split("(")[0].trim();
        }

        if (!map[name]) map[name] = 0;
        map[name] += item.amount;
    });

    // If empty
    if (Object.keys(map).length === 0) {
        container.innerHTML = "<p>No debts owed to you. 🎉</p>";
        return;
    }

    // Populate grouped results
    for (const [name, amount] of Object.entries(map)) {
        const div = document.createElement('div');
        div.classList.add('item');
        div.innerHTML = `${name}: ₱${amount.toFixed(2)}`;
        container.appendChild(div);
    }
}


// Function to calculate all totals and update the Summary box
function calculateTotals() {
    const totalIncome = entries.income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = entries.expense.reduce((sum, item) => sum + item.amount, 0);
    const totalLiabilities = entries.liability.reduce((sum, item) => sum + item.amount, 0);
    const totalDebtsOwed = entries.debtOwed.reduce((sum, item) => sum + item.amount, 0);

    const netBalance = (totalIncome + totalDebtsOwed) - (totalExpenses + totalLiabilities);

    document.getElementById('totalLiabilities').textContent = totalLiabilities.toFixed(2);
    document.getElementById('totalDebtsOwed').textContent = totalDebtsOwed.toFixed(2);
    document.getElementById('netBalance').textContent = netBalance.toFixed(2);

    updatePeopleWhoOweYou();
}