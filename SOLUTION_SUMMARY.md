# Solution for Persisting Product Quantity Changes

You've encountered a classic state synchronization issue. Here’s a breakdown of the problem and the step-by-step solution to fix it.

## The Problem: Why Quantity Resets

The root cause is that your application only updates the product quantity in the **frontend state**, not in the **Supabase database**.

Here's the current (incorrect) flow:

1.  **Sell Button Clicked**: The `SellForm` component calls the `handleSell` function in `Store.jsx`.
2.  **Local State Update**: `handleSell` dispatches a `SELL_STORE` action to the central state management (`AppContext.jsx`).
3.  **UI Updates**: The reducer for `SELL_STORE` updates the local JavaScript array of products, decrementing the quantity. React re-renders the component, and you see the updated quantity in the UI.
4.  **No Database Update**: No request is sent to Supabase to update the `products` table. The backend still has the old quantity.
5.  **Page Refresh**: When you refresh the page, the application re-fetches all product data from Supabase. Since the database was never updated, it returns the original quantity, and your UI reverts to the old state.

## The Solution: Syncing Frontend with Supabase

To fix this, we need to treat Supabase as the **single source of truth**. The frontend should send an update request to the database for every persistent change.

Here is the correct architectural flow we will implement:

1.  **Initiate Sale**: The `handleSell` function will be called as before.
2.  **Update Supabase**: Instead of just dispatching to the local state, `handleSell` will now call a new function that sends an `update` request to your Supabase `products` table. This request will tell Supabase to decrement the quantity of the specific product.
3.  **Update Local State**: Once Supabase confirms the update was successful, we will then update the local frontend state using the same `dispatch` mechanism. This ensures the UI stays in sync with the database.
4.  **UI Reflects Change**: The UI updates, showing the new, lower quantity.
5.  **Page Refresh**: Now, when you refresh, the app fetches from Supabase, which has the correctly updated quantity. The UI will show the correct data.

This approach is called a **Pessimistic Update**. We wait for the database to confirm the change before updating the UI. It guarantees that the UI never shows a state that hasn't been saved.

### Next Steps

I will now provide the exact code changes to implement this correct flow. The changes will be in two files:

1.  `src/context/AppContext.jsx`: To create a new action that handles the database update.
2.  `src/pages/Store.jsx`: To use this new action in the `handleSell` function.