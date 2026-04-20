package auth

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type CustomClaims struct {
	UserId   string `json:"userId"`
	Nickname string `json:"nickname"`
	jwt.RegisteredClaims
}

func GenerateGuestToken(nickname string) (string, error) {
	userId := uuid.New().String()

	claims := CustomClaims{
		UserId:   userId,
		Nickname: nickname,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	secret := []byte(os.Getenv("JWT_SECRET"))

	return token.SignedString(secret)
}

func ValidateToken(tokenstring string) (string, string, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))

	token, err := jwt.ParseWithClaims(tokenstring, &CustomClaims{}, func(t *jwt.Token) (interface{}, error) {
		return secret, nil
	})

	if err != nil {
		return "", "", err
	}

	if claims, ok := token.Claims.(*CustomClaims); ok && token.Valid {
		return claims.UserId, claims.Nickname, nil
	}

	return "", "", errors.New("invalid token claims")
}
