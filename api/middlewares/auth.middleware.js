import jwt from 'jsonwebtoken'
export const authMiddleware = (req, res, next) => {
    // Try to get token from cookies first, then from Authorization header
    let token = req.cookies.authToken;
    
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    
    if(!token) {
        console.log("unauthorized - no token provided");
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please sign in.'
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if(err){
            console.log('Token verification error:', err.message);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token. Please sign in again.'
            });
        }
        req.user = user;
        next();
    });
};