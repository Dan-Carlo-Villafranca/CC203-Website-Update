// Store all entries to easily calculate totals
let entries = {
    income: [],
    expense: [],
    liability: [],
    debtOwed: []
};

// Main function to add an item
function addItem(type) {
    let descInput, amountInput, listId;
    
    // Map the function call to the specific HTML elements
    switch(type) {
        case 'income':
            descInput = document.getElementById('incomeDesc');
            amountInput = document.getElementById('incomeAmount');
            listId = 'incomeList';
            break;
        case 'expense':
            descInput = document.getElementById('expenseDesc');
            amountInput = document.getElementById('expenseAmount');
            listId = 'expenseList';
            break;
        case 'liability':
            descInput = document.getElementById('liabilityDesc');
            amountInput = document.getElementById('liabilityAmount');
            listId = 'liabilityList';
            break;
        case 'debtOwed':
            descInput = document.getElementById('debtOwedDesc');
            amountInput = document.getElementById('debtOwedAmount');
            listId = 'debtOwedList';
            break;
        default:
            return;
    }

    const description = descInput.value.trim();
    const amount = parseFloat(amountInput.value);

    // Simple validation
    if (description === '' || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid description and amount.");
        return;
    }

    // Create a unique ID for the item to manage removal
    const itemId = Date.now(); 
    const entry = { id: itemId, description, amount };
    entries[type].push(entry);

    // Update the HTML list
    const list = document.getElementById(listId);
    const newItem = document.createElement('div');
    newItem.classList.add('item');
    newItem.setAttribute('data-id', itemId);
    newItem.setAttribute('data-type', type);
    
    // Determine button text based on section
    let buttonText = 'Remove';
    if (type === 'liability') {
        buttonText = 'Paid Off';
    } else if (type === 'debtOwed') {
        buttonText = 'Paid Back';
    }
    
    newItem.innerHTML = `
        ${description}: $${amount.toFixed(2)}
        <button class="remove-btn" onclick="removeItem(${itemId}, '${type}')">${buttonText}</button>
    `;
    list.appendChild(newItem);

    // Clear inputs
    descInput.value = '';
    amountInput.value = '';

    // Recalculate all totals
    calculateTotals();
}

// Function to remove an item (handles the calculation when removing liabilities or debts)
function removeItem(id, type) {
    // Remove the item from the JavaScript storage (entries array)
    entries[type] = entries[type].filter(item => item.id !== id);

    // Remove the item from the HTML view
    const itemElement = document.querySelector(`.item[data-id="${id}"][data-type="${type}"]`);
    if (itemElement) {
        itemElement.remove();
    }

    // Recalculate all totals after removal
    calculateTotals();
}

// Function to calculate all totals and update the Summary box
function calculateTotals() {
    // Calculate totals for each category
    const totalIncome = entries.income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = entries.expense.reduce((sum, item) => sum + item.amount, 0);
    const totalLiabilities = entries.liability.reduce((sum, item) => sum + item.amount, 0);
    const totalDebtsOwed = entries.debtOwed.reduce((sum, item) => sum + item.amount, 0);

    // Calculate Net Balance: (Income + Debts Owed TO YOU) - (Expenses + Liabilities)
    const netBalance = (totalIncome + totalDebtsOwed) - (totalExpenses + totalLiabilities);

    // Update the HTML summary spans
    document.getElementById('totalLiabilities').textContent = totalLiabilities.toFixed(2);
    document.getElementById('totalDebtsOwed').textContent = totalDebtsOwed.toFixed(2);
    document.getElementById('netBalance').textContent = netBalance.toFixed(2);
}