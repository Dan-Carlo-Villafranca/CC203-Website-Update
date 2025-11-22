from flask import Flask, render_template, request, redirect, url_for, jsonify, flash
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, current_user, logout_user, login_required
from datetime import datetime

# --- INITIALIZATION ---
app = Flask(__name__)

# Set a SECRET_KEY for security (flash messages, session management)
app.config['SECRET_KEY'] = 'your_super_secret_key_change_me'

# --- DATABASE CONFIGURATION ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tracker.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- SECURITY CONFIGURATION ---
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'  # The function name for the login route
login_manager.login_message_category = 'info'  # For flash messages


# --- USER LOADER ---
# This is required by Flask-Login to reload the user object from the session ID
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# --- DATABASE MODELS ---

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)
    # Relationship to transactions: 'User' has many 'Transaction'

    transactions = db.relationship('Transaction', backref='owner', lazy=True)

    def __repr__(self):
        return f"User('{self.username}', '{self.email}')"


class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    transaction_type = db.Column(db.String(20), nullable=False)
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    # Foreign Key: Links transaction to the user who owns it
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    def __repr__(self):
        return f'<Transaction {self.description} | {self.transaction_type}>'

# NEW METHOD: Converts Transaction object to a dictionary
    def to_dict(self):
        return {
            'id': self.id,
            'description': self.description,
            'amount': self.amount,
            'transaction_type': self.transaction_type,
            # Note: date_created is usually not needed in this specific context
        }

# --- DATABASE CREATION SCRIPT ---
# This block must run once to create/update the database with the new 'user' table
with app.app_context():
    db.create_all()
    print("Database and tables (User, Transaction) created/updated!")


# ---------------------------------------------
# --- AUTHENTICATION ROUTES (HTML Forms) ---
# ---------------------------------------------

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))  # Redirect if already logged in

    if request.method == 'POST':
        # Get data from the registration form
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')

        # Check if user/email already exists
        user = User.query.filter_by(username=username).first()
        if user:
            flash('Username already taken.', 'danger')
            return render_template('register.html')

        # Hash the password for security
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

        new_user = User(username=username, email=email, password=hashed_password)
        db.session.add(new_user)
        db.session.commit()

        flash('Your account has been created! You are now able to log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))  # Redirect if already logged in

    if request.method == 'POST':
        email = request.form.get('username')
        password = request.form.get('password')

        user = User.query.filter(
            (User.username == email) | (User.email == email)
        ).first()

        # Verify email exists and password is correct
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user, remember=True)  # Log the user in and remember session
            flash(f'Welcome back, {user.username}!', 'success')
            # Redirect to the main page after successful login
            return redirect(url_for('index'))
        else:
            flash('Login Unsuccessful. Please check email and password', 'danger')

    return render_template('login.html')


@app.route('/logout')
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))


# ---------------------------------------------
# --- APPLICATION ROUTES (Secured by login_required) ---
# ---------------------------------------------

# The main route for the application
@app.route('/')
@login_required  # Protects this route: user must be logged in to view
def index():
    # Only retrieve transactions belonging to the current user
    entries = Transaction.query.filter_by(user_id=current_user.id).all()

    # NEW LINE: Convert the list of objects into a list of dictionaries
    entries_for_json = [entry.to_dict() for entry in entries]

    return render_template('app.html', entries=entries_for_json)


# Route to add a new transaction
@app.route('/add', methods=['POST'])
@login_required  # Protects this route
def add_transaction():
    data = request.get_json()

    if not data or 'type' not in data or 'description' not in data or 'amount' not in data:
        return jsonify({'error': 'Invalid data'}), 400

    new_transaction = Transaction(
        description=data['description'],
        amount=float(data['amount']),
        transaction_type=data['type'],
        user_id=current_user.id  # Link transaction to the current user (Ayaw iremove)
    )

    try:
        db.session.add(new_transaction)
        db.session.commit()
        return jsonify({
            'success': True,
            'id': new_transaction.id,
            'description': new_transaction.description,
            'amount': new_transaction.amount,
            'type': new_transaction.transaction_type
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# Route to delete a transaction
@app.route('/delete/<int:item_id>', methods=['DELETE'])
@login_required  # Protects this route
def delete_transaction(item_id):
    # Retrieve the transaction AND ensure it belongs to the current user
    transaction_to_delete = Transaction.query.filter_by(id=item_id, user_id=current_user.id).first_or_404()

    try:
        db.session.delete(transaction_to_delete)
        db.session.commit()
        return jsonify({'success': True, 'id': item_id})
    except:
        return jsonify({'error': 'Could not delete item'}), 500


# Run the application
if __name__ == '__main__':
    app.run(debug=True)